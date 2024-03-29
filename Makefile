.PHONY: build
build:
	bin/build

.PHONY: invalidate
invalidate:
	aws cloudfront create-invalidation \
		--distribution-id $(shell pulumi stack output distributionID --cwd infra) \
		--paths $(shell find site/public -name "*.html" -o -name "*.css" -o -name "*.js" | sed "s/^site\/public//g")

.PHONY: process
process:
	docker run -it \
		-e AWS_ACCESS_KEY_ID \
		-e AWS_SECRET_ACCESS_KEY \
		-e GITHUB_PERSONAL_ACCESS_TOKEN \
		-v ~/Desktop/Exports:/media \
		$(shell pulumi config get service_image --cwd infra) \
		npm start /media

.PHONY: release
release:
	bin/docker && \
	git commit -am "Release $(shell pulumi config get service_image --cwd infra)" && \
	git fetch -p && \
	git rebase origin/master && \
	git push origin master

.PHONY: install
ensure:
	npm install

.PHONY: serve
serve:
	npm run serve

.PHONY: watch_site
watch_site:
	open "http://localhost:1313/"
	pushd site && \
	hugo serve && \
	popd

.PHONY: watch_sass
watch_sass:
	node_modules/.bin/node-sass --include-path site/scss --output site/static/css site/scss/main.scss --watch

.PHONY: test
test: build
	npm run test

.PHONY: travis
travis: build
	./ci/travis_push.sh
