"use strict";

var gulp = require("gulp");
var gutil = require("gulp-util");

var source = require("vinyl-source-stream");
var buffer = require("vinyl-buffer");
var uglify = require("gulp-uglify");
var sourcemaps = require("gulp-sourcemaps");
var livereload = require("gulp-livereload");
var concat = require("gulp-concat");

var browserify = require("browserify");
var watchify = require("watchify");

require("node-jsx").install;

process.env.PEERJS_API_KEY = process.env.PEERJS_API_KEY || "w68p17ra5u1y8pvi";

var paths = {
  html: [
    "./src/*.html"
  ],

  json: [
    "./src/*.json"
  ],

  js: [
    require("./package.json").main
  ],

  vendor: [
  ],

  img: [
    "./src/img/*"
  ]
};

function bundleOrWatch() {
  var watch = arguments[0] === undefined ? false : arguments[0];

  var b = browserify({
    cache: {},
    packageCache: {},
    extensions: [".jsx"],
    fullPaths: false,
    entries: paths.js,
    debug: true
  });

  var bundle = function () {
    var bundler = arguments[0] === undefined ? b : arguments[0];

    // Add transformation tasks to the pipeline here.
    bundler.bundle()
      .on("error", gutil.log)
      .pipe(source("bundle.js"))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(uglify({ mangle: true }))
      .pipe(sourcemaps.write("."))
      .pipe(gulp.dest("./dist/js/"))
      .pipe(livereload());
  };

  if (!watch) {
    bundle();
  } else {
    (function () {
      var w = watchify(b);

      w.on("update", function () {
        gutil.log("Watchify update...");
        bundle(w);
      });

      bundle(w);
    })();
  }
}

gulp.task("html", function () {
  gulp.src(paths.html).pipe(gulp.dest("./dist/")).pipe(livereload());
});

gulp.task("img", function () {
  gulp.src(paths.img).pipe(gulp.dest("./dist/img/")).pipe(livereload());
});

gulp.task("json", function () {
  gulp.src(paths.json).pipe(gulp.dest("./dist/")).pipe(livereload());
});

gulp.task("vendor", function () {
  gulp.src(paths.vendor).on("error", gutil.log).pipe(concat("vendor.js")).pipe(gulp.dest("./dist/js/"));
});

gulp.task("browserify", function () {
  bundleOrWatch(false);
});

gulp.task("watch", function () {
  livereload.listen();

  bundleOrWatch(true);

  gulp.watch(paths.vendor, ["vendor"]);
  gulp.watch(paths.html, ["html"]);
  gulp.watch(paths.json, ["json"]);
  gulp.watch(paths.img, ["img"]);
});

gulp.task("server", function (done) {
  var http = require("http");
  var express = require("express");
  var path = require("path");

  var app = express();

  var sendFile = function (req, res) {
    res.sendFile(path.join(__dirname, "dist", req.path));
  };

  app.get("/**/*.js", sendFile);
  app.get("/**/*.map", sendFile);
  app.get("/img/*.png", sendFile);
  app.get("/img/*.jpg", sendFile);
  app.get("/*.json", sendFile);

  app.get("/*", function (req, res) {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });

  http.createServer(app).listen(3000, done);
});

gulp.task("build", ["html", "json", "img", "browserify", "vendor"]);
gulp.task("hack", ["build", "server", "watch"]);
gulp.task("default", ["build"]);