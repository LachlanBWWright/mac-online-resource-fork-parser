# Classic Mac application fixtures

These resource forks are compiled outputs from the open-source [Retro68](https://github.com/autc04/Retro68) sample applications. They are included as small, varied parser fixtures rather than as bundled application downloads.

Source revision: `f99ecb5aeb6fbb004c647518ea760daba2b1f6bb`

| File | Retro68 sample | Resource types exercised |
| --- | --- | --- |
| `Dialog.rsrc` | `Samples/Dialog` | `CODE`, `DITL`, `DLOG`, `SIZE` |
| `WDEFShell.rsrc` | `Samples/WDEF` | `CODE`, `MENU`, `STR#`, `TEXT`, `WDEF`, `WIND` |
| `Raytracer.rsrc` | `Samples/Raytracer` | `CODE`, `DATA`, `RELA`, `SIZE` |
| `Raytracer2.rsrc` | `Samples/Raytracer` | `CODE`, `DATA`, `RELA`, `SIZE` |

Retro68 is licensed under GPL-3.0-or-later. Its README documents the sample applications and the licensing of compiled programs: <https://github.com/autc04/Retro68#license>.

Additional public fixtures

| File | Source | Resource types exercised |
| --- | --- | --- |
| `../opensource/Retro68-SystemExtension.rsrc` | [Retro68 SystemExtension](https://github.com/autc04/Retro68/tree/master/Samples/SystemExtension) | `ICN#`, `icl4`, `icl8`, `ics#`, `ics4`, `ics8` |
| `../opensource/RezillaPlugin.icns.rsrc` | [Rezilla](https://github.com/chrisballinger/rezilla) | `icns` |
| `../opensource/RecklessDrivin.Data.rsrc` | [Reckless Drivin' source release](https://github.com/jechter/RecklessDrivin) | `Pack`, `PPic`, `Chck` |
| `../opensource/glider/Glider-BW-Art.rsrc` | [Glider 4.0](https://github.com/softdorothy/Glider4) | `PICT`, `deep` |
| `../opensource/glider/Glider-Color-Art.rsrc` | [Glider 4.0](https://github.com/softdorothy/Glider4) | `PICT`, `deep` |
| `../opensource/glider/Glider-Project.rsrc` | [Glider 4.0](https://github.com/softdorothy/Glider4) | `PHDX`, `FHDR`, `FVOL`, `FSEG`, `CODE`, `DATA`, and project metadata |

The Rezilla fixture is distributed under the project’s GPL-2.0-or-later terms; the original source is retained at the linked repository.

The Reckless Drivin' fixture is from the repository's MIT-licensed source release. The repository notes that its original resource forks were moved into the data fork to make them suitable for Git; this copy is the extracted resource-fork payload.

The Glider 4.0 repository is MIT-licensed. These files were originally MacBinary containers; the `.rsrc` fixtures here contain only their embedded resource-fork payloads.
