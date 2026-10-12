[![License](https://img.shields.io/github/license/eligarf/pf2e-stealthy?label=License)](LICENSE)
[![Latest Version](https://img.shields.io/github/v/release/eligarf/pf2e-stealthy?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/eligarf/pf2e-stealthy/releases/latest)
![Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https%3A%2F%2Fraw.github.com%2Feligarf%2Fpf2e-stealthy%2Frelease%2Fmodule.json)

![Latest Downloads](https://img.shields.io/github/downloads/eligarf/pf2e-stealthy/latest/total?color=blue&label=latest%20downloads)
![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpf2e-stealthy&colorB=4aa94a)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rule671908)
[Discord thread](https://discord.com/channels/880968862240239708/1408174774382755900)

# PF2e Stealthy

A module for FoundryVTT that manages token-paired initiative and action-related stealth checks during combat :w
using chat cards. It can dynamically change the rendering of tokens based on the specific stealth relationship between the controlled token(s) and any tokens on the canvas that have the module's custom Stealth effect applied.

## Module Tenets

- The term *stealth* is used to refer only to the stealth effect created by PF2e Stealthy - it does not refer to other sources for the hidden or undetected condition.
- This module is for tactical combat stealth only - its *stealth* effects are only valid during initiative and encounter mode ie combat.
    - Exploration mode is hand-wavey by its very nature, so it is assumed that the party token is a valid choice to use during time spent in the mode.
    - Doing any specific character location-based stealth vision/rules stuff during encounter mode is out-of-scope for PF2e Stealthy.
    - All *stealth* effects are cleared when combat ends.
- This module only handles *stealth* effects directly controlling the hidden and undetected conditions due to the results of stealth or perception checks vs token DCs.
    - **It is not a general vision solution**
    - It is likely that there many edge cases between *stealth*-based hidden and other sources such as Invisibility. Most of these will be considered out-of-scope due to not tackling more general vision issues.
- The only effects used are placed on the characters using the *stealth* effect - no preparation is required for any potential viewing tokens.
    - *Stealth* effects use standard rule elements, and so can be inspected/edited or deleted if something appears to go wrong
- It does not police the conditions for correctness - this is left up to the GM.
    - It does no cover or concealment calculations; this is out-of-scope until some standard cover testing module/system appears.
    - It does not automatically remove stealth when you take other actions or move out of cover. Too many variables and "whoops, I didn't mean to attack Fiesty Goblin but rather Lazy Goblin" situations occur.


