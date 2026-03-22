all:
	echo "package o frontend"

package: clean frontend
	npx electron-builder -w
	npx electron-builder -l

frontend: $(wildcard src/common/*) $(wildcard src/table/*) $(wildcard src/detail/*) $(wildcard src/import/*) $(wildcard ../signotator/src/*)
	npx vite build

dev: frontend
	npm start

clean:
	rm -rf dist

.PHONY: all package frontend clean dev
