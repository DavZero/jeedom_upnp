#!/bin/bash
######################### INCLUSION LIB ##########################
BASEDIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
wget https://raw.githubusercontent.com/NebzHB/dependance.lib/master/dependance.lib -O $BASEDIR/dependance.lib &>/dev/null
PLUGIN=$(basename "$(realpath $BASEDIR/..)")
. ${BASEDIR}/dependance.lib
##################################################################
TIMED=1
wget https://raw.githubusercontent.com/NebzHB/nodejs_install/main/install_nodejs.sh -O $BASEDIR/install_nodejs.sh &>/dev/null

installVer='14' 	#NodeJS major version to be installed

pre
step 0 "Vérification des droits"
DIRECTORY="/var/www"
if [ ! -d "$DIRECTORY" ]; then
	silent sudo mkdir $DIRECTORY
fi
silent sudo chown -R www-data $DIRECTORY

step 5 "Mise à jour APT et installation des packages nécessaires"
try sudo apt-get update

#install nodejs, steps 10->50
. ${BASEDIR}/install_nodejs.sh ${installVer}

step 60 "Nettoyage anciens modules"
cd ${BASEDIR};
#remove old local modules
#silent sudo rm -rf node_modules
#silent sudo rm -f package-lock.json
cd ../node/
npm cache clean
sudo npm cache clean
sudo rm -rf node_modules

step 70 "Installation des librairies du démon, veuillez patienter svp"
#silent sudo mkdir node_modules 
#silent sudo chown -R www-data:www-data . 
#try sudo npm install --no-fund --no-package-lock --no-audit
#silent sudo chown -R www-data:www-data . 
silent sudo mkdir node_modules
silent sudo chown -R www-data:www-data node_modules

#echo 80 > ${PROGRESS_FILE}
step 80
try sudo npm install --unsafe-perm ip
#echo 82 > ${PROGRESS_FILE}
step 82
try sudo npm install --unsafe-perm xml2js
#echo 86 > ${PROGRESS_FILE}
step 84
try sudo npm install --unsafe-perm request
#echo 88 > ${PROGRESS_FILE}
step 86
try sudo npm install --unsafe-perm portfinder
#echo 90 > ${PROGRESS_FILE}
step 88
try sudo npm install --unsafe-perm html-entities
#echo 92 > ${PROGRESS_FILE}
step 90

silent sudo chown -R www-data *

step 100 "Installation des dépendances Upnp terminée, vérifiez qu'il n'y a pas d'erreur"

