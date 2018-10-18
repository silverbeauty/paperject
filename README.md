# paperjet-web


Paperjet Web Application

## Setup Environment (OSX)

	# install Node.js
	brew install node.js

	# install MongoDB
	brew install mongodb

    # install Redis 2
    brew install redis


## Setup Project

	# download source code
	git clone git@github.com:paperjet/paperjet-web.git
	cd paperjet-web/src/

	# install client-side packages
	npm install -g bower
	bower install
	# choose ember#canary when prompted

	# install server-side packages
	npm install

## Build Client

	npm install -g grunt-cli
	grunt watchClient
	# keep this command running

## Run Server

	# open new terminal
	# start MongoDB
	mongod --config /usr/local/etc/mongod.conf

	# open new terminal
	# start Node.js server
	cd paperjet-web/src/
	mkdir logs
	npm install -g nodemon
	npm run-script nodemon
	# application is available at http://localhost:3000
