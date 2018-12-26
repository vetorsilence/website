build:
	rm -rf site/public
	node-sass --include-path site/scss --output site/static/css site/scss/main.scss
	hugo --baseURL https://chris.nunciato.org --source site

deploy: build
	AWS_PROFILE=personal pulumi up

serve:
	pushd site && \
	hugo serve --buildDrafts false && \
	popd

preview:
	AWS_PROFILE=personal pulumi preview

process:
	./scripts/process.sh ~/Desktop/Exports
