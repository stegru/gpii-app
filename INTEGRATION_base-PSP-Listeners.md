# Integration summary for the creation of base-PSP-Listeners

## GPII-APP repository

1. Created initial branch based on current Astea's PR for PCP.
```
$ git fetch upstream refs/pull/27/head:PCP
```

where, upstream is:
```
upstream	git@github.com:GPII/gpii-app.git (fetch)
upstream	git@github.com:GPII/gpii-app.git (push)
```

Saved PR as new branch "PCP" https://github.com/gloob/gpii-app/tree/PCP

PCP:head is 575cd002ea4d918234c4196c31416889aaba0a10

2. Created base branch for the integration of the base-PSP-Listeners
```
$ git checkout -b base-PSP-Listeners
```
from the PCP branch.

## GPII Windows repository

1. Created initial branch based on windows#hst-2017, saved as gloob/windows#base-PSP-Listeners
2. Updated package.json to point to the new location.
3. Windows repo is pointing to universal#master in the same way than current PSP development.

## GPII Universal repository

1. Created initial branch based on universal#master, saved as gloob/universal#base-PSP-Listeners.

## Non merged PRs

1. Adding #2204 (Listeners) using current integration of stegru at stegru/gpii-app#PILOT2
  git remote add stegru https://github.com/stegru/gpii-app.git
  git fetch stegru
  git merge stegru/PILOT2

and windows

  git remote add stegru https://github.com/stegru/windows.git
  git fetch stegru
  git merge stegru/PILOT2

and universal

  git remote add stegru https://github.com/stegru/universal.git
  git fetch stegru
  git merge stegru/PILOT2
