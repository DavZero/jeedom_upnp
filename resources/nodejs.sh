#!/bin/bash
cd $1
touch /tmp/upnp_dep
echo "Début de l'installation"

echo 0 > /tmp/upnp_dep
DIRECTORY="/var/www"
if [ ! -d "$DIRECTORY" ]; then
  echo "Création du home www-data pour npm"
  sudo mkdir $DIRECTORY
  sudo chown -R www-data $DIRECTORY
fi
echo 10 > /tmp/upnp_dep
actual=`nodejs -v`;
echo "Version actuelle : ${actual}"

if [[ $actual == *"4."* || $actual == *"5."* ]]
then
  echo "Ok, version suffisante";
else
  echo "KO, version obsolète à upgrader";
  echo "Suppression du Nodejs existant et installation du paquet recommandé"
  sudo apt-get -y --purge autoremove nodejs npm
  arch=`arch`;
  echo 30 > /tmp/upnp_dep
  if [[ $arch == "armv6l" ]]
  then
    echo "Raspberry 1 détecté, utilisation du paquet pour armv6"
    sudo rm /etc/apt/sources.list.d/nodesource.list
    wget http://node-arm.herokuapp.com/node_latest_armhf.deb
    sudo dpkg -i node_latest_armhf.deb
    sudo ln -s /usr/local/bin/node /usr/local/bin/nodejs
    rm node_latest_armhf.deb
  else
    echo "Utilisation du dépot officiel"
    curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  new=`nodejs -v`;
  echo "Version actuelle : ${new}"
fi

echo 70 > /tmp/upnp_dep

cd ../node/
npm cache clean
sudo npm cache clean
sudo rm -rf node_modules

echo 80 > /tmp/upnp_dep
sudo npm install --unsafe-perm ip
echo 82 > /tmp/upnp_dep
sudo npm install --unsafe-perm xml2js
echo 86 > /tmp/upnp_dep
sudo npm install --unsafe-perm request
echo 88 > /tmp/upnp_dep
sudo npm install --unsafe-perm portfinder
echo 90 > /tmp/upnp_dep
sudo npm install --unsafe-perm html-entities
echo 92 > /tmp/upnp_dep

sudo chown -R www-data *

rm /tmp/upnp_dep

echo "Fin de l'installation"
