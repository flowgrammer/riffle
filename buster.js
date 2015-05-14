var config = module.exports;

config["Riffle tests"] = {
    environment: "node",
    rootPath: "./",
    sources: [
        "lib/riffle.js",      // Paths are relative to config file
    ],
    tests: [
        "test/*-test.js"
    ]
};
