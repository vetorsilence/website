build:
	rm -rf site/public
	node-sass --include-path site/scss --output site/static/css site/scss/main.scss
	hugo --baseURL https://chris.nunciato.org --source site

deploy: build
	pulumi up

serve:
	pushd site && \
	hugo serve --buildDrafts false && \
	popd