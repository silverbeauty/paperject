# Enable Firewall

    sudo ufw allow 22
    sudo ufw allow 80
    sudo ufw allow 443
    sudo ufw allow 3000
    sudo ufw allow 3001
    sudo ufw enable

# Enable key auth

    sudo mv /etc/ssh/sshd_config /etc/ssh/sshd_config.orig
    sudo nano /etc/ssh/sshd_config

    cat ~/.ssh/id_rsa.pub | ssh dental@128.199.220.96 "mkdir ~/.ssh; cat >> ~/.ssh/authorized_keys" # on host machine

    sudo service ssh  restart
    exit # to test key auth

# Update apt-get
    sudo apt-get update

# Update Shell

    sudo apt-get install zsh
    curl -L http://install.ohmyz.sh | sh

If you wish to increase security in this area, set the ubuntu user password and adjust the /etc/sudoers file.

	sudo passwd ubuntu
	sudo perl -pi -e 's/^(ubuntu.*)NOPASSWD:(.*)/$1$2/' /etc/sudoers

Make sure you set the password successfully first and remember it. If you change the sudoers file first, you will be stuck with no root access on that instance.


# Install Software

    sudo apt-get install git ruby rubygems-integration zip unzip redis-server pdftk

    sudo add-apt-repository ppa:chris-lea/node.js
    sudo apt-get update
    sudo apt-get install python-software-properties python g++ make nodejs redis-server

    sudo npm install -g forever bower grunt

# Install nginx
    sudo apt-get install nginx

# Configure Redis

Connect to Redis and execute:

	config set maxmemory 104857600 # set to 100Mb, pick another value if more memory is available
	config set maxmemory-policy allkeys-lru # this is default option, maybe we should try volatile-lru

Set password: edit ```/etc/redis/redis.conf``` and add line ```requirepass <pass>```.

Allow Redis traffic from specific macnines:

	ufw allow proto tcp from 162.243.1.1 to any port 6379


#Configure MongoDB

To accept remote connections:

	nano /etc/mongodb.conf
	edit:
	bind_ip=0.0.0.0

Firewall rule:

	sudo ufw allow proto tcp from x.x.x.x to any port 27017

# Create Folders

    mkdir paperjet-web
    mkdir paperjet-queue-router
    mkdir paperjet-web-config
    mkdir paperjet-web-uploads
    mkdir backup

# Common Scripts

## backup-production.sh script

	#!/bin/bash

	die() {
	    echo "$*" 1>&2
	    exit 1
	}

	zip -r ~/backup/paperjet-web-$(date "+%Y.%m.%d-%H.%M.%S").zip ~/paperjet-web  || die "Error"

	zip -r ~/backup/paperjet-queue-router-$(date "+%Y.%m.%d-%H.%M.%S").zip ~/paperjet-queue-router  || die "Error"

## update-production.sh script

    #!/bin/bash

    die() {
        echo "$*" 1>&2
        exit 1
    }

    cd ~

    # backup
    chmod +x backup-production.sh   || die "Error"
    source backup-production.sh     || die "Error"

    # remove instance
    rm -Rf paperjet-web            || die "Error"
    rm -Rf paperjet-queue-router            || die "Error"

    # build app
    git clone git@github.com:paperjet/paperjet-web.git   || die "Error"

    cd paperjet-web/src         || die "Error"
    mkdir logs                  || die "Error"
    bower --allow-root install  || die "Error"
    npm install                 || die "Error"
    grunt build                 || die "Error"

    # DB migration
    node node_modules/mongo-migrate -runmm up

    cd ../..
    git clone git@github.com:paperjet/paperjet-queue-router.git   || die "Error"
    cd paperjet-queue-router/src || die "Error"
    mkdir logs                  || die "Error"
    npm install                 || die "Error"

## stop-production.sh script

	#!/bin/sh

	cd ~/paperjet-web/src/
	forever stop ~/paperjet-web/src/app.js

	cd ~/paperjet-queue-router/src/
	forever stop ~/paperjet-queue-router/src/app.js

	# cd ~/paperjet-detector/http_server/
	# forever stop ~/paperjet-detector/http_server/ffd.js

# Staging

## Queue Instances

### User Data script

	PJ_QUEUE_HOST_NAME=stg-queue-

### start-production.sh script

    #!/bin/sh

    S3_USER_DATA=$(ec2metadata --user-data)

    PJ_QUEUE_HOST_NAME=$(echo $S3_USER_DATA | grep PJ_QUEUE_HOST_NAME= | sed -E 's/.*=(.*)/\1/')$(ec2metadata --instance-id)

    cd ~/paperjet-queue-router/src/
    PJ_QUEUE_HOST_NAME=$PJ_QUEUE_HOST_NAME \
    EC2_INSTANCE_ID=$(ec2metadata --instance-id) \
    EC2_AMI_ID=$(ec2metadata --ami-id) \
    EC2_INSTANCE_TYPE=$(ec2metadata --instance-type) \
    PJ_S3_KEY=<key> PJ_S3_SECRET=<secret> \
    PJ_REDIS_PASS="" PJ_REDIS_HOST=<host> \
    PJ_FFD_HOST=localhost \
    PJ_FAX_CREDENTIALS='<creds>' \
    PJ_NEWRELIC_KEY=<key> \
    PJ_MANDRILL_USER=<email> PJ_MANDRILL_PASS=<pass> PJ_MAIL_FROM=<email> \
    PJ_QUEUE_PROFILE=true PJ_QUEUE_LOG_LEVEL=debug \
    PJ_MONGO_CONNECTION_STRING=<connection str> \
    NODE_ENV=production forever start -e router.err.log -a ~/paperjet-queue-router/src/app.js

    forever list


## Web Instances

### start-production.sh script

	#!/bin/sh

	cd ~/paperjet-web/src/
	PJ_SSL_KEY=~/key.pem PJ_SSL_CERT=~/cert.pem \
	PJ_MONITORING_PATH=ABC PJ_MONITORING_USER=<email> \
	PJ_MONITORING_PASS=<pass> PJ_MONITORING_LOG_LEVEL=silly \
	PJ_REDIS_PASS=<pass> PJ_REDIS_HOST=<host> \
	PJ_NEWRELIC_KEY=<key> \
	PJ_MANDRILL_USER=<email> PJ_MANDRILL_PASS=<pass> PJ_MAIL_FROM=<email> \
	PJ_GOOGLE_CLIENT_ID=<id> PJ_GOOGLE_CLIENT_SECRET=<pass> \
	PJ_S3_KEY=<key> PJ_S3_SECRET=<secret> \
	PJ_WEB_LOG_LEVEL=silly PJ_WEB_HOST_NAME=<host> PJ_APP_URL=<url> PJ_APP_SERVER_PORT=3000 \
    PJ_STRIPE_PUBLIC_KEY=<key> PJ_STRIPE_SECRET_KEY=<key> \
    PJ_STRIPE_PLAN_MONTHLY=monthly1 PJ_STRIPE_PLAN_YEARLY=yearly1 \
	NODE_ENV=production forever start -e paperjet.err.log -a ~/paperjet-web/src/app.js

	forever list

# Production Instances

## Queue Instances

### User Data Script

	PJ_QUEUE_HOST_NAME=prod-queue-
	PJ_S3_KEY=<key>
	PJ_S3_SECRET=<key>
	PJ_REDIS_HOST=<host>
	PJ_MONGO_CONNECTION_STRING=<conn>

### start-production.sh

    #!/usr/bin/zsh

    S3_USER_DATA=$(ec2metadata --user-data)

    PJ_QUEUE_HOST_NAME=$(echo $S3_USER_DATA | grep PJ_QUEUE_HOST_NAME= | sed -E 's/.*=(.*)/\1/')$(ec2metadata --instance-id)
    PJ_S3_KEY=$(echo $S3_USER_DATA | grep PJ_S3_KEY= | sed -E 's/.*=(.*)/\1/')
    PJ_S3_SECRET=$(echo $S3_USER_DATA | grep PJ_S3_SECRET= | sed -E 's/.*=(.*)/\1/')
    PJ_REDIS_HOST=$(echo $S3_USER_DATA | grep PJ_REDIS_HOST= | sed -E 's/.*=(.*)/\1/')
    PJ_MONGO_CONNECTION_STRING=$(echo $S3_USER_DATA | grep PJ_MONGO_CONNECTION_STRING= | sed -E 's/.*=(.*)/\1/')

    cd ~/paperjet-queue-router/src/
    PJ_QUEUE_HOST_NAME=$PJ_QUEUE_HOST_NAME \
    EC2_INSTANCE_ID=$(ec2metadata --instance-id) \
    EC2_AMI_ID=$(ec2metadata --ami-id) \
    EC2_INSTANCE_TYPE=$(ec2metadata --instance-type) \
    PJ_S3_KEY=$PJ_S3_KEY PJ_S3_SECRET=$PJ_S3_SECRET \
    PJ_REDIS_PASS="" PJ_REDIS_HOST=$PJ_REDIS_HOST \
    PJ_FFD_HOST=localhost \
    PJ_FAX_CREDENTIALS='<credentials>' \
    PJ_NEWRELIC_KEY=<key> \
    PJ_MANDRILL_USER=<email> PJ_MANDRILL_PASS=<pass> PJ_MAIL_FROM=<email> \
    PJ_QUEUE_PROFILE=true PJ_QUEUE_LOG_LEVEL=debug \
    PJ_MONGO_CONNECTION_STRING=$PJ_MONGO_CONNECTION_STRING \
    NODE_ENV=production forever start -e router.err.log -a ~/paperjet-queue-router/src/app.js

    forever list


# Setup New Relic

	echo deb http://apt.newrelic.com/debian/ newrelic non-free >> /etc/apt/sources.list.d/newrelic.list

Trust the New Relic GPG key.

	wget -O- https://download.newrelic.com/548C16BF.gpg | apt-key add -

Update the local package list.

	apt-get update

Install the Server Monitor package

Run the install command:

	apt-get install newrelic-sysmond

Configure & start the Server Monitor daemon

Add license key to config file: (See /etc/newrelic/nrsysmond.cfg for other config options)

	nrsysmond-config --set license_key=42c7e57c1a47ff66fe59e210df1a04dee01a478e

Start the daemon:

	/etc/init.d/newrelic-sysmond start

# Create upstart script

```nano /etc/init/nodeapps.conf```

	# Start Paperjet nodejs instances

	start on startup
	exec sudo -u ubuntu -i /home/ubuntu/replace-production.sh > /home/ubuntu/replace-production-$(date "+%Y.%m.%d-%H.%M.%S").log
