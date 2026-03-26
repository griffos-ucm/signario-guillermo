all:
	echo "package o frontend"

BSQ3_VERSION = $(shell node -e "console.log(require('better-sqlite3/package.json').version)")
# Electron module ABI: update when changing Electron major version
# See https://releases.electronjs.org/releases.json
ELECTRON_ABI = 145

package: clean frontend
	npx electron-builder -w --dir
	@echo "Replacing better-sqlite3 native module with win32-x64 prebuild..."
	curl -fL "https://github.com/WiseLibs/better-sqlite3/releases/download/v$(BSQ3_VERSION)/better-sqlite3-v$(BSQ3_VERSION)-electron-v$(ELECTRON_ABI)-win32-x64.tar.gz" \
		| tar xz -C dist/win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3/
	npx electron-builder -w --prepackaged dist/win-unpacked
	npx electron-builder -l

frontend: $(wildcard src/common/*) $(wildcard src/table/*) $(wildcard src/detail/*) $(wildcard src/import/*) $(wildcard ../signotator/src/*)
	npx vite build

dev: frontend
	npm start

clean:
	rm -rf dist

.PHONY: all package frontend clean dev
