#!/usr/bin/env sh

./cleanup.sh

cd ~/forest

./buildPublic.sh

cd ~/stschaef.github.io

cp -r ../forest/output/* .

git add .

echo $(date -I) | git commit --file -

git push origin master
