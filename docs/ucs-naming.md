# UCS naming in RO.SMap

Based on the Universal Category System file naming convention (Tim Nielsen et al.).

Official references:

- [ucs-community: UCS File Naming Convention](https://github.com/iluvcapra/ucs-community/blob/master/docs/ucs_file_naming_convention.rst)
- [universalcategorysystem.com](https://universalcategorysystem.com/)

## Required shape

```
CatID_FXName_CreatorID_SourceID
```

Optional full form:

```
CatID(-UserCategory)_(VendorCategory-)FXName_CreatorID_SourceID_UserData
```

- Underscores `_` separate **blocks only** — do not use `_` inside FXName.
- Spaces are allowed inside FXName.
- The only strict UCS requirement is a valid **CatID** at the start of the filename.

## RO.SMap mapping

| Block | Value |
|-------|--------|
| CatID | Subcategory select (`#add-subcat`, e.g. `AMBCity`) |
| FXName | English short title (`#add-user-defined`), auto-translated from description via Yandex Translate |
| CreatorID | Recordist / login (latin, no spaces) |
| SourceID | Always `ROSMAP` |
| UserData | `{channelCode}-{locationSlug}` e.g. `XY-Rostov` |

Example:

```
AMBCity_Rostov Market Day Crowd_romaflay_ROSMAP_XY-Rostov.wav
```

Cloud object keys stay `uploads/{login}/audio_{soundId}.wav`. The UCS name is stored in `fileName`, used as download name, and embedded into WAV metadata (bext / iXML) on publish.
