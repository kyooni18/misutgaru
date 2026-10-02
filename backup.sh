sudo rm -rf backuptmp
sudo rm -rf backuptmp
sudo rm -rf backuptmp
mkdir backuptmp
sudo cp -r .config/ backuptmp/.config/
sudo cp -r files/ backuptmp/files/
sudo cp -r redis/ backuptmp/redis/
sudo cp -r db/ backuptmp/db/

sudo tar -Jcf backup.tar.xz backuptmp/

sudo rm -rf backuptmp
sudo rm -rf backuptmp
sudo rm -rf backuptmp
