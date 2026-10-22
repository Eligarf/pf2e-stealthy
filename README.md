[![License](https://img.shields.io/github/license/eligarf/pf2e-stealthy?label=License)](LICENSE)
[![Latest Version](https://img.shields.io/github/v/release/eligarf/pf2e-stealthy?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/eligarf/pf2e-stealthy/releases/latest)
![Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https%3A%2F%2Fraw.github.com%2Feligarf%2Fpf2e-stealthy%2Frelease%2Fmodule.json)

![Latest Downloads](https://img.shields.io/github/downloads/eligarf/pf2e-stealthy/latest/total?color=blue&label=latest%20downloads)
![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpf2e-stealthy&colorB=4aa94a)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rule671908)

# PF2e Stealthy

A light-weight module for PF2e/SF2e in FoundryVTT that manages token-to-token hidden and undetected conditions, as well as initiative and action-related stealth checks during combat using chat cards. It can dynamically change the rendering of tokens based on the specific stealth relationship between the controlled token(s) and any tokens on the canvas that have the module's custom Stealth effect applied. It is essentially an replacement of and extension to the PF2e Avoid Notice module. 

## Chat card examples

![Avoidance Check](https://github.com/user-attachments/assets/109db87a-498a-4942-812e-e9fa7962a2f9) ![Initiative](https://github.com/user-attachments/assets/05de5522-a9b9-4952-8d8a-e6588770b92c) ![Hide](https://github.com/user-attachments/assets/bfc9ce59-58c2-4fc6-a6cc-01e01055ad3d) ![Sneak](https://github.com/user-attachments/assets/3b04766a-42f7-4113-a4d4-f705ffd60140) ![Seek](https://github.com/user-attachments/assets/4fc02469-0c4f-4212-8dc7-8d3d697ce67f) ![Point Out](https://github.com/user-attachments/assets/5823e900-0501-4e9f-95a9-60dfe11eb7fa)

## Module Tenets

> [!CAUTION]
> ![Not a vision system](https://github.com/user-attachments/assets/75c79e62-cc31-4334-86b6-c13d9ab0f311)
>
> PF2e Stealthy is not and will not be a general vision solution. It is likely that there many edge cases between stealth-based hidden and other sources of hidden or undetected - most of these will be considered out-of-scope.

> [!NOTE]
> For brevity, I'll define *Stealthy* to be the module's generated effect and a *Stealthy* token or actor as one which has the *Stealthy* effect.

PF2e Stealthy:
- is a light-weight and predictable stealth manager.
- uses the *Stealthy* effect which controls the hidden and undetected conditions based on the results of stealth or perception checks. These are straightforward effects plainly visible to the GM and use standard REs.
- is for tactical combat stealth only, and *stealthy* effects are only valid during initiative and encounter mode.
- uses chat cards as its primary interface.
- requires no prep on non-*stealthy* tokens. All data is carried on the *stealthy* actors.
- does not police actions or states for cover or validity and simply does the mechanics since the GM is free to adjust results before they are applied.

## Exploration Mode

> [!CAUTION]
> Implementing any tactical exploration features during encounter mode is out-of-scope for PF2e Stealthy. GMs wishing to do more tactical exploration probably should look elsewhere for vision/stealth support.

As explained in the Core rulebook, exploration mode is hand-wavey by its very nature, so this module assumes that the party token is a valid choice to focus on during exploration mode in Foundry. An 'Avoidance Check' is available on PF2e Stealthy's context menu that manages having any selected party, character, and monster tokens do Avoid Notice rolls so the GM can determine whether or not there is to be an encounter. Selected Party tokens will generate stealth roll requests for any PCs using Avoid Notice even if they aren't on the map yet, and if the GM determines there will be an encounter based on the results, PCs can be deposited from the party token, positioned on the map in some way that makes sense to everyone, and then *stealthy* characters will use the Avoidance Check results as their initiative rolls.

## Combat Mode

> [!CAUTION]
> Cover calculations, Darkness, Concealment, etc are not taken into account when granting stealth. It is up to the GM to verify or modify any results accordingly on the chat cards.

This module basically tracks which tokens should be granted an exception to the hidden or undetected conditions carried by *stealthy* actors. It assumes that if a *stealthy* actor has achieved the hidden or undetected condition, it is hidden to all other tokens except for those who are on its specific exception list for its conditions. No cover calculations are done (this is out-of-scope), but if one day there is a standard way to calculate cover I'll likely use it to add the bonus to the sneak checks. The cover condition is used if present, but nothing token-to-token

When a creature takes a Hide or Sneak action, PF2e Stealthy will append a target list to the roll chat card listing each observing token, dc, and resulting stealth status for that observer. The GM can click on any results to change specific ones for whatever reason like missing cover or whatever, and the clicks the Apply Effects button to store that info into the *stealthy* effect. Once the actor is *stealthy*, the module's context menu will offer a choice to edit and present a new chat card where the GM can tweak stealth settings as needed. Seek checks work similarly, allowing the GM to modify the seek results prior to accepting the changes, and the Point Out action, if accepted, will set appropriate allied tokens to see the pointed out token as hidden.

The *Stealthy* effect uses a badge to track the baseline stealth of the actor, and grants the hidden and undetected conditions based on the level of the badge. It uses signature predicates to conditionally disable the condition roll options it grants depending on the target of the roll. If the vision hack is enabled, *stealthy* tokens will show on the GM canvas as with a thick cyan border if no tokens are controlled or if the *stealthy* token is undetected to all controlled tokens.

![Vision Hack GM View](https://github.com/user-attachments/assets/0a6795e6-b144-4a9f-9cef-18c0f8ecdd18) ![Vision Hack Player View](https://github.com/user-attachments/assets/65f3ddde-0c95-4ea8-bf93-5913d8c4ff61)

These images show the GM view and player view when controlling a *stealthy* Merisiel. She is undetected as a baseline and can see an Ogre but not the goblin who is undetected by her, indicated to the GM by the cyan outline borders. The goblin had a critical success when seeking and Merisiel is now observed to it, indicated by the triangle exclamation. The goblin has also pointed out Merisiel to the Ogre, so Merisiel is now only hidden to the Ogre, indicated by the circle question mark. Merisiel is still undetected to any other tokens on the canvas.

## Context Menu

A context menu is triggered by '=' in the key maps (there is probably a better way to do it but this keeps it out of the way). When pressed, it will list some relevant options based on what tokens were controlled/targeted/or both. If there are only controlled tokens or targeted tokens, the menu options will list the same and apply the actions accordingly - no need to switch which way you might be designating something. When both controlled and targeted tokens are present, the menus will present mirrored choices; you might want to clear stealth on the attacking token, or you might need to clear out a forgotten state on the targeted token.

The following is a list of the menu options that can appear when pressing the menu context key. In practice you will find some variations on some of the entries, but the core of them are here.

| Menu option | Prerequisites | Details |
| ----------- | ------------- | ------- |
| Avoidance Check | Selected or targeted tokens | Sends a chat message with the avoidance check details to the GM |
| Clear Ambush | Out of combat, selected or targeted non-party tokens using stealth for initiative | Set initiative statistic to 'perception' for any actors using 'stealth' |
| De-clump Initiative | In combat, no tokens controlled or targeted | Spreads out the initiative value of all combatants, resulting in a gap of 3 between each |
| Edit Stealth | Single *stealthy* token selected or targeted | Sends a chat card to the GM where they can edit the stealth values vs that token's potential observers |
| Prepare Ambush | Out of combat, selected or targeted non-party tokens not using stealth for initiative | Sets the actors' initiative statistics to 'stealth', and ghosts the tokens (sets Foundry hidden) |
| Refresh all | None | Sends a refresh perception signal to all clients |
| Remove stealth | group of controlled or targeted tokens | Removes all stealth effects from the selected *stealthy* actors |
| Reveal controlled token | Set of controlled and set of targeted tokens | Adds exceptions for the targeted tokens to the stealth conditions of any *stealthy* controlled actors | 
| Undo controlled reveals | Set of controlled and set of targeted tokens | Removes any exceptions for the targeted tokens from the stealth conditions of the *stealthy* controlled actors |
