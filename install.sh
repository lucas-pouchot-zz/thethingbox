#!/bin/bash

NRS_DIRECTORY="node-red-src"
NR_DIRECTORY="node_modules/node-red"
NR_COMMIT="ef53dca0628cca360795fe05cab91e146c8207fb"

npmInstall(){
	npm install --unsafe-perm --legacy-bundling
}

getNodeRED(){
	if [ ! -d "$NRS_DIRECTORY" ]
	then
		git clone https://github.com/node-red/node-red.git $NRS_DIRECTORY
		cd $NRS_DIRECTORY
		git checkout $NR_COMMIT
		rm .git* -r
		cd ..
		patch -s -p0 < node-red-src_ttb.patch
	fi
}

installNodeRed(){
	cd $NRS_DIRECTORY
	npm install --only=dev --unsafe-perm --legacy-bundling
	./node_modules/.bin/grunt release
	cd ..
	if [ ! -d "$NR_DIRECTORY" ]
	then
		mv $NRS_DIRECTORY/.dist/node-red* $NR_DIRECTORY
		cd $NR_DIRECTORY
		npm install --only=prod --unsafe-perm --legacy-bundling
	fi
}

npmInstall
npmInstall
getNodeRED
installNodeRed