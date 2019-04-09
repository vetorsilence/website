build:
	rm -rf site/public
	node_modules/.bin/node-sass --include-path site/scss --output site/static/css site/scss/main.scss
	hugo --baseURL https://chris.nunciato.org --source site

deploy: build
	$(MAKE) update
	$(MAKE) invalidate

preview:
	pulumi preview

update:
	pulumi up --yes --skip-preview

invalidate:
	aws cloudfront create-invalidation \
		--distribution-id $(shell pulumi stack output cloudfrontDistributionId) \
		--paths $(shell find site/public -name "*.html" -o -name "*.css" -o -name "*.js" | sed "s/^site\/public//g")

process:
	docker run -it -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -v ~/Desktop/Exports:/media cnunciato/process

process-local:
	./scripts/process.sh ~/Desktop/Exports

clean:
	rm -rf node_modules
	rm -rf package-lock.json

ensure:
	npm install

serve:
	open "http://localhost:1313/"
	pushd site && \
	hugo serve && \
	popd

serve_public:
	$(MAKE) build
	cd site/public
	open "http://localhost:1314"
	php -S localhost:1314
	cd ..

watch_sass:
	node_modules/.bin/node-sass --include-path site/scss --output site/static/css site/scss/main.scss --watch

work:
	code website.code-workspace

travis:
	./scripts/travis_push.sh
