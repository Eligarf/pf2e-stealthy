## pending

## 1.1.6

- Refresh clients when stealth changes are applied

## 1.1.5

- better feedback for player when they roll avoidance check
- player can see ineligibility message if they roll stealth without avoid notice activity
- added images for readme

## 1.1.4

- Players can use the end stealth buttons as well

## 1.1.3

- Fixed some player/GM data visibility errors

## 1.1.2

- filter unnecessary detectors if GM edits results from hide/sneak actions

## 1.1.1

- Fix stream-crossing of targetId and tokenId

## 1.1.0

- Add opt-out setting that prevents dead NPCs from being added to combat
- Make a hole for future combat start shenanigans

## 1.0.0

- Released to foundry

## 0.11.2

- new minified unity build
- got split button working

## 0.11.1

- Don't show vision alerts for allies
- Add a reduce-to-hidden button for actions when undetected
- Added better regexs to catch more actions that end stealth
- Disable end-stealth button on seek for now because issues

## 0.11.0

- Add an 'End Stealth' button to the chat card of any action (other than step, hide, or sneak) taken by a stealthy character.

## 0.10.0

- Vision alerts now have two levels: triangle-exclamation for observed and circle-question for hidden. If enabled, these only appear on tokens to the GM when a controlled token has the stealthy condition and observing tokens they are in combat with have better visibility to the stealthy token than the stealth baseline ie observed vs hidden and observed/hidden vs undetected.
- Move HTML generation to .hbs files

## 0.9.1

- filterMap keys on token documents, not tokens

## 0.9.0

- New caching strategy
- Re-enable GM-only undetected filter

## 0.8.2

- Put GM visibility restriction on target list summaries
- Disable gm-viewed undetected hack until we figure out edge cases

## 0.8.1

- Fix onClick case error

## 0.8.0

- better context menu

## 0.7.1

- disabled menu items are grayed out

## 0.7.0

- menu improvements

## 0.6.0

- Vision Hack now shows undetected characters to GM

## 0.5.1

- Use fa-eye as the source for the visibility indicator instead of the system icon placeholder

## 0.5.0

- Stealthy attackers push an ephemeral off-guard condition on targets as appropriate to that target's visibility of the attacker

## 0.4.1

- Added some explanation text to the card when Point Out doesn't otherwise do anything

## 0.4.0

- Sneak Adept supported

## 0.3.1

- Tooltips are passed as array and get localized during render

## 0.3.0

- Added Point Out handling and effect editing
