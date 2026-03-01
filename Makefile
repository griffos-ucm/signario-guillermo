ENV:=NODE_ENV=development

all:
	echo "package o frontend"

package: ENV=NODE_ENV=production
package: clean frontend
	npx electron-builder -w
	npx electron-builder -l

frontend: dist/table/index.html dist/detail/index.html dist/import/index.html

clean:
	rm -rf dist

.PHONY: all package frontend clean

.SECONDEXPANSION:

dist/%/index.html: tailwind.config.js $(wildcard src/common/*) $$(wildcard src/$$*/*) $(wildcard ../signotator/src/*)
	@mkdir -p $(@D)
	$(ENV) npx parcel build \
		--no-autoinstall --no-content-hash --no-cache \
		--no-optimize --target $*
