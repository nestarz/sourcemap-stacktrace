module.exports = {
  tryc: (fn) => {
    try {
      return [fn(), false];
    } catch (error) {
      return [undefined, error || true];
    }
  },
};
