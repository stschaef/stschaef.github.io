#!/usr/bin/env sh

./cleanup.sh

cd ~/forest

./buildPublic.sh

rm output/index.html

cd ~/stschaef.github.io

cp -r ../forest/output/* .

git add .

echo $(date -I) | git commit --file -

git push origin master

cd ~/forest

./build.sh
