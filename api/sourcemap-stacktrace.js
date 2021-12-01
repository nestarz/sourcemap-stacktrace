const stackTraceParser = require("stacktrace-parser");
const { SourceMapConsumer } = require("source-map");
const allowCors = require("./allowCors");
const { tryc } = require("./utils");

const getSourceMap = (file) => {
  const mapPath = `${file}.map`;
  return import("node-fetch").then(({ default: fetch }) =>
    fetch(mapPath)
      .then((r) => r.json())
      .catch(() => {
        throw new Error("No sourcemap found at " + mapPath);
      })
  );
};

const mapStacktrace = async (str) => {
  const stack = stackTraceParser.parse(str);
  const files = [...new Set(stack.map(({ file }) => file))];

  const mapContent = Object.fromEntries(
    (await Promise.all(files.map(getSourceMap))).map((map, i) => [
      files[i],
      map,
    ])
  );
  const smcs = await Promise.all(
    stack
      .map(({ file }) => mapContent[file])
      .map((map) => new SourceMapConsumer(map))
  );

  if (stack.length === 0) throw new Error("No stack found");

  return [
    str.split("\n").find((line) => line.trim().length > 0),
    ...stack.map(({ methodName, lineNumber: line, column }, i) => {
      const [pos, error] =
        line === null || line < 1
          ? [undefined, false]
          : tryc(() => smcs[i].originalPositionFor({ line, column }));

      return error
        ? "at FAILED_TO_PARSE_LINE"
        : pos
        ? `at ${pos.name || ""} (${pos.source}:${pos.line}:${pos.column})`
        : `at ${methodName || ""}`;
    }),
  ]
    .filter((v) => v)
    .join("\n    ");
};

module.exports = allowCors((req, res) => {
  const { stacktrace } = req?.body ?? {};
  if (!stacktrace) {
    res.writeHead(200);
    res.end("OK");
  }

  mapStacktrace(stacktrace)
    .then((data) => {
      res.writeHead(200);
      res.end(data);
    })
    .catch((e) => {
      res.writeHead(500);
      res.end(JSON.stringify(e));
    });
});

if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require?.main === module
) {
  mapStacktrace(
    `Error: Showtime not found, but found fallback at {"bookingLink":"https://s.cinemaspathegaumont.com/#/V3010S33208?","language":"french","cinemaId":"Pathé Wepler","cinemaName":"Pathé Wepler","address":"140, bd de Clichy et 8, av de Clichy","fullDay":false,"eventDescription":"Avec tombola","eventName":null,"lat":48.884192,"lng":2.3286,"city":"Paris","special":"390a3034-0962-48de-811b-08ff6e6d803b","phone":"0 892 69 66 96","startAt":"2021-12-04T11:00:00.000Z"}
    at console.error (https://d1wph4sn4v5ycm.cloudfront.net/index.js:34:1356)
    at _ (https://les-elfkins-operation-patisserie.lefilm.co/693-6ba6fec210503be64cb8.js:1:5566)
    at ro (https://les-elfkins-operation-patisserie.lefilm.co/framework-044e196b14ef008958cf.js:2:59961)
    at Bo (https://les-elfkins-operation-patisserie.lefilm.co/framework-044e196b14ef008958cf.js:2:69479)
    at Hu (https://les-elfkins-operation-patisserie.lefilm.co/framework-044e196b14ef008958cf.js:2:113174)
    at Pi (https://les-elfkins-operation-patisserie.lefilm.co/framework-044e196b14ef008958cf.js:2:99406)
    at _i (https://les-elfkins-operation-patisserie.lefilm.co/framework-044e196b14ef008958cf.js:2:99334)
    at xi (https://les-elfkins-operation-patisserie.lefilm.co/framework-044e196b14ef008958cf.js:2:99197)
    at vi (https://les-elfkins-operation-patisserie.lefilm.co/framework-044e196b14ef008958cf.js:2:96184)
    at https://les-elfkins-operation-patisserie.lefilm.co/framework-044e196b14ef008958cf.js:2:45856`
  ).then(console.log);
}
