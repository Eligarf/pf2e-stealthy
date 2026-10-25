@echo off
npx esbuild src/main.js --bundle --minify --outfile=dist/main.min.js --sourcemap
npx esbuild src/style.css --minify --outfile=dist/style.min.css

