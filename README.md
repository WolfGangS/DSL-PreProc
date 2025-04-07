# DSL Preproc

A kinda crappy pre-processor aimed at Second Life scripting

## Supports

- LSL
- SLua
  - Adds compile time require support
  - `local lib = require("./other")` will look for `.luau` file endings
    automatically if not specified.
  - All preproc commands need to be prefixed with `--`
    - e.g. `--#include ../defines.luau`
- Output format for the
  [SL External Editor](https://marketplace.visualstudio.com/items?itemName=wlf-io.sl-external-editor)
  extension
- Basic preproc commands
  - `#include <file_name>` Include a file (Relative to current file only for
    now, so `./../file.luau` or so)
  - `#define NAME value` define a value
  - `#ifdef NAME` check if `NAME` is defined and advance to `#else` or `#endif`
    if it isn't
  - `#ifndef NAME` check if `NAME` is not defined and advance to `#else` or
    `#endif` if it is
  - `#else` else for `ifdef` and `ifndef`
  - `#endif` endif

Recommended to be used with the above extension, in fact it will offer it as a
default download at some point.

## Commandline usage

Download the `dsl_preproc` for your platform and either add to your path or work
in the same folder as it

```
dls_preproc --file <filename>
```

It also supports the following arguments

- `--lang [lsl/slua]` override the automatic language detection

## Planned features

- `.luaurc` support for finding includes for require starting with `@`
- `--root <directory>` argument to set the directory to use as root for `/`
  includes.
