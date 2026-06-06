class Database {
  constructor() {}
  run() { return this; }
  query() { return { all: () => [], get: () => null }; }
  prepare() { return { run: () => {}, all: () => [], get: () => null }; }
}

module.exports = { Database };

