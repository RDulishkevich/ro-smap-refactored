# UCS naming in RO.SMap

Based on the Universal Category System file naming convention (Tim Nielsen et al.), UCS **8.2.1** catalog (82 categories / 752 CatIDs).

Official references:

- [ucs-community: UCS File Naming Convention](https://github.com/iluvcapra/ucs-community/blob/master/docs/ucs_file_naming_convention.rst)
- [universalcategorysystem.com](https://universalcategorysystem.com/)

## Required shape

```
CatID_FXName_CreatorID_SourceID[_UserData]
```

## RO.SMap mapping

| Block | Value |
|-------|--------|
| CatID | Full UCS 8.2.1 subcategory (`#add-subcat`) |
| FXName | English short title; **words joined with `_`** (auto-translated from description) |
| CreatorID | Recordist / login (latin, no spaces) |
| SourceID | Always `ROSMAP` |
| UserData | `{channelCode}-{locationSlug}` e.g. `XY-Rostov` |

Example:

```
AMBCity_Rostov_Market_Day_Crowd_romaflay_ROSMAP_XY-Rostov.wav
```

On upload, the app reads bext / iXML / filename: date, time, keywords, CatID and FXName are applied to the form when present (otherwise date/time from file `lastModified`).

Cloud object keys stay `uploads/{login}/audio_{soundId}.wav`. The UCS name is stored in `fileName`, used as download name, and on publish the full add-sound form snapshot is embedded into WAV metadata (bext + Open iXML `USER`/`ROSMAP_JSON` + LIST INFO): title, description, UCS, tags, place/GPS, date/time, weather, principle, gear/mic/format/channels, license, recordist, duration, session, route.
