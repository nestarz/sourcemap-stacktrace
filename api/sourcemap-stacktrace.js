const stackTraceParser = require("stacktrace-parser");
const { SourceMapConsumer } = require("source-map");
const { URL } = require("url");
const allowCors = require("./allowCors");

const mapStacktrace = async (str, sourceMapDir) => {
  const fetch = await import("node-fetch").then(({ default: fetch }) => fetch);

  const stack = stackTraceParser.parse(str);
  const mapPath = stack[0].file.includes("http")
    ? `${stack[0].file}.map`
    : new URL(`${stack[0].file}.map`, sourceMapDir);
  const mapContent = await fetch(mapPath)
    .then((r) => r.json())
    .catch(() => {
      throw new Error("No sourcemap found at " + mapPath);
    });

  try {
    const smc = await new SourceMapConsumer(mapContent);
    if (stack.length === 0) throw new Error("No stack found");
    return [
      str.split("\n").find((line) => line.trim().length > 0),
      ...stack.map(({ methodName, lineNumber, column }) => {
        try {
          if (lineNumber == null || lineNumber < 1) {
            return `at ${methodName || ""}`;
          } else {
            const pos = smc.originalPositionFor({ line: lineNumber, column });
            if (pos && pos.line != null) {
              return `at ${pos.name || ""} (${pos.source}:${pos.line}:${
                pos.column
              })`;
            }

            // console.log('src', smc.sourceContentFor(pos.source));
          }
        } catch (err) {
          return "at FAILED_TO_PARSE_LINE";
        }
      }),
    ]
      .filter((v) => v)
      .join("\n    ");
  } catch (err) {
    console.error(err);
    return err;
  }
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
    `Error: Request failed with status code 500
  at dU (https://-/assets/vendor.b59915a5.js:206:132232)
  at SU (https://-/assets/vendor.b59915a5.js:206:133900)
  at XMLHttpRequest.PU.i.onreadystatechange (https://-/assets/vendor.b59915a5.js:206:135064)`
  ).then(console.log);
}
