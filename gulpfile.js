var gulp = require('gulp');
var zip = require('gulp-zip');
var del = require('del');
var install = require('gulp-install');
var runSequence = require('run-sequence');
var awsLambda = require('node-aws-lambda');
var seq = require('run-sequence');
var shell = require('gulp-shell');
var espower = require('gulp-espower');
var mocha = require('gulp-mocha');
var babel = require('gulp-babel');

// Test
 
gulp.task('babel:lib',    shell.task(["babel src --out-dir test-es5"]));
gulp.task('babel:test',    shell.task(["babel test --out-dir test-es5"]));
gulp.task('espower', function() {
  return gulp.src("test-es5/**/*.js")
    .pipe(espower())
    .pipe(gulp.dest("test-espowerd"));
});
gulp.task('mocha', function () {
  return gulp.src(['test-espowerd/driver.js'])
    .pipe(mocha({timeout: 10*1000}));
});
gulp.task('test', function(done) {seq(['babel:lib', 'babel:test'], 'espower', 'mocha', done)});

//
// Deploy
//
// distディレクトリのクリーンアップと作成済みのdist.zipの削除
gulp.task('clean', function(cb) {
  del(['./dist', './dist.zip'], cb);
});
 
// AWS Lambdaファンクション本体(index.js)をdistディレクトリにcompile
gulp.task("js", function () {
  return gulp.src("src/*.js")
    .pipe(babel())
    .pipe(gulp.dest("dist"));
});
 
// AWS Lambdaファンクションのデプロイメントパッケージ(ZIPファイル)に含めるnode.jsパッケージをdistディレクトリにインストール
// ({production: true} を指定して、開発用のパッケージを除いてインストールを実施)
gulp.task('node-mods', function() {
  return gulp.src('./package.json')
    .pipe(gulp.dest('dist/'))
    .pipe(install({production: true}));
});
 
// デプロイメントパッケージの作成(distディレクトリをZIP化)
gulp.task('zip', function() {
  return gulp.src(['dist/**/*', '!dist/package.json'])
    .pipe(zip('dist.zip'))
    .pipe(gulp.dest('./'));
});
 
// AWS Lambdaファンクションの登録(ZIPファイルのアップロード)
// (既にFunctionが登録済みの場合はFunctionの内容を更新)
gulp.task('upload', function(callback) {
  awsLambda.deploy('./dist.zip', require("./lambda-config.js"), callback);
});
 
gulp.task('deploy', function(callback) {
  return runSequence(
    ['clean'],
    ['js', 'node-mods'],
    ['zip'],
    ['upload'],
    callback
  );
});

