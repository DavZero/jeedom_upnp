#!/bin/bash
PROGRESS_FILE=/tmp/upnp_dep
installVer='12' 	#NodeJS major version to be installed
minVer='12'	#min NodeJS major version to be accepted

touch ${PROGRESS_FILE}
echo 0 > ${PROGRESS_FILE}
echo "--0%"
BASEDIR=$1
cd $BASEDIR
DIRECTORY="/var/www"
if [ ! -d "$DIRECTORY" ]; then
  echo "Création du home www-data pour npm"
  sudo mkdir $DIRECTORY
  sudo chown -R www-data $DIRECTORY
fi


echo 10 > ${PROGRESS_FILE}
echo "--10%"
echo "Lancement de l'installation/mise à jour des dépendances upnp"

echo 20 > ${PROGRESS_FILE}
echo "--20%"
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y lsb-release

echo 30 > ${PROGRESS_FILE}
echo "--30%"
if [ -x /usr/bin/nodejs ]
then
  actual=`nodejs -v | awk -F v '{ print $2 }' | awk -F . '{ print $1 }'`
  echo "Version actuelle : ${actual}"
else
  actual=0;
  echo "Nodejs non installé"
fi
arch=`arch`;

#jeedom mini and rpi 1 2, 12 does not support arm6l
if [[ $arch == "armv6l" ]]
then
  installVer='8' 	#NodeJS major version to be installed
  minVer='8'	#min NodeJS major version to be accepted  
fi

#jessie as libstdc++ > 4.9 needed for nodejs 12
lsb_release -c | grep jessie
if [ $? -eq 0 ]
then
  installVer='8' 	#NodeJS major version to be installed
  minVer='8'	#min NodeJS major version to be accepted  
fi

bits=`getconf LONG_BIT`
vers=`lsb_release -c | grep stretch | wc -l`
if { [ "$arch" = "i386" ] || [ "$arch" = "i686" ]; } && [ "$bits" -eq "32" ] && [ "$vers" -eq "1" ]
then 
  installVer='8' 	#NodeJS major version to be installed
  minVer='8'	#min NodeJS major version to be accepted  
fi

if [ $actual -ge ${minVer} ]
then
  echo "Ok, version suffisante"
else
  echo 40 > ${PROGRESS_FILE}
  echo "--40%"
  echo "KO, version obsolète à upgrader";
  echo "Suppression du Nodejs existant et installation du paquet recommandé"
  sudo DEBIAN_FRONTEND=noninteractive apt-get -y --purge autoremove nodejs npm

  echo 45 > ${PROGRESS_FILE}
  echo "--45%"
  if [[ $arch == "armv6l" ]]
  then
    echo "Raspberry 1, 2 ou zéro détecté, utilisation du paquet v${installVer} pour ${arch}"
    #wget https://nodejs.org/download/release/latest-v${installVer}.x/node-*-linux-${arch}.tar.gz
    wget -P ./tmp -r -l1 -nd -np --accept-regex='node-.*-linux-${arch}\.tar\.gz' https://nodejs.org/download/release/latest-v${installVer}.x/
    cd ./tmp
    nodegz=`ls node-.*-linux-${arch}.tar.gz`
    tar -xvf $nodegz
    sudo cp -R node-*-linux-${arch}/* /usr/local/
    cd ..
    rm -fR tmp
    #upgrade to recent npm
    sudo npm install -g npm
  else
    echo "Utilisation du dépot officiel"
    curl -sL https://deb.nodesource.com/setup_${installVer}.x | sudo -E bash -
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  fi

  new=`nodejs -v`;
  echo "Version actuelle : ${new}"
fi

echo 70 > ${PROGRESS_FILE}

cd ../node/
npm cache clean
sudo npm cache clean
sudo rm -rf node_modules

sudo mkdir node_modules
sudo chown -R www-data:www-data node_modules

echo 80 > ${PROGRESS_FILE}
sudo npm install --unsafe-perm ip
echo 82 > ${PROGRESS_FILE}
sudo npm install --unsafe-perm xml2js
echo 86 > ${PROGRESS_FILE}
sudo npm install --unsafe-perm request
echo 88 > ${PROGRESS_FILE}
sudo npm install --unsafe-perm portfinder
echo 90 > ${PROGRESS_FILE}
sudo npm install --unsafe-perm html-entities
echo 92 > ${PROGRESS_FILE}

sudo chown -R www-data *

echo 100 > ${PROGRESS_FILE}
echo "--100%"
echo "Installation des dépendances Upnp terminée, vérifiez qu'il n'y a pas d'erreur"

rm -f ${PROGRESS_FILE}
