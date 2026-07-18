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
| SourceID | **Project** from the linked expedition/session title (sanitized). Without expedition → `NONE` |
| UserData | `{channelCode}-{locationSlug}` e.g. `XY-Rostov` |

Example with expedition «Дон 2026»:

```
AMBCity_Rostov_Market_Day_Crowd_romaflay_Don2026_XY-Rostov.wav
```

Without expedition:

```
AMBCity_Rostov_Market_Day_Crowd_romaflay_NONE_XY-Rostov.wav
```

### Platform ID is metadata-only

The unique platform recording id (`soundId`) and platform tag `ROSMAP` are **embedded inside the WAV** (bext OriginatorReference, iXML `SOUND_ID` / `PLATFORM_ID`, `ROSMAP_JSON`) and are **never** placed in the UCS filename or download fallback name.

On upload, the app reads bext / iXML / filename: date, time, keywords, CatID and FXName are applied to the form when present (otherwise date/time from file `lastModified`).

Cloud object keys stay `uploads/{login}/audio_{soundId}.wav`. The UCS name is stored in `fileName`, used as download name, and on publish the full add-sound form snapshot is embedded into WAV metadata (bext + Open iXML `USER`/`ROSMAP_JSON` + LIST INFO).

### Expedition archive

From the expedition description view, **Скачать архив** packs all published recordings linked via `sessionId` into a ZIP (owners/admins also get their unpublished files with a URL).
