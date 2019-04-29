.PHONY: build
build:
	rm -rf site/public
	node_modules/.bin/node-sass --include-path site/scss --output site/static/css site/scss/main.scss
	hugo --baseURL https://chris.nunciato.org --source site

.PHONY: deploy
deploy: build
	$(MAKE) update

.PHONY: preview
preview:
	pulumi preview

.PHONY: update
update:
	pulumi up --yes --skip-preview

.PHONY: invalidate
invalidate:
	aws cloudfront create-invalidation \
		--distribution-id $(shell pulumi stack output cloudfrontDistributionId) \
		--paths $(shell find site/public -name "*.html" -o -name "*.css" -o -name "*.js" | sed "s/^site\/public//g")

.PHONY: process
process:
	docker run -it \
		-e AWS_ACCESS_KEY_ID \
		-e AWS_SECRET_ACCESS_KEY \
		-e GITHUB_PERSONAL_ACCESS_TOKEN \
		-v ~/Desktop/Exports:/media \
		$(shell pulumi config get image_tag) \
		npm start /media

.PHONY: docker
docker:
	bin/docker

.PHONY: release
release:
	$(MAKE) docker build deploy
	git status

.PHONY: clean
clean:
	rm -rf node_modules
	rm -rf package-lock.json

.PHONY: ensure
ensure:
	npm install

.PHONY: serve
serve:
	open "http://localhost:1313/"
	pushd site && \
	hugo serve && \
	popd

.PHONY: serve_built
serve_built:
	$(MAKE) build
	cd site/public
	open "http://localhost:1314"
	php -S localhost:1314
	cd ..

.PHONY: watch_sass
watch_sass:
	node_modules/.bin/node-sass --include-path site/scss --output site/static/css site/scss/main.scss --watch

.PHONY: travis
travis: build
	./ci/travis_push.sh
