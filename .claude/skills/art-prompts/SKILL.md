---
name: art-prompts
description: Write image-generation prompts for cards from their data and the art style guide. Run as /art-prompts.
disable-model-invocation: true
argument-hint: "[era, or card ids]"
---
1. Read docs/design/art-style.md in full. If it doesn't exist, stop and say so.
2. Collect the cards for $ARGUMENTS: every card in packages/content/cards/<era>/, or the listed ids.
   Use each card's name, history note and art reference only. Never use its rules text or numbers.
3. Write one prompt per card to assets/prompts/<era>.md, in card-id order:
   ## <card-id> - <card name>
   - Prompt: subject, setting, mood, composition and palette, following the style guide
   - Reference images to attach: paths from the style guide or the card's art reference
   - Aspect ratio from the style guide
4. Prompts never name real people or show recognisable likenesses: describe roles instead
   ("a head of state at a podium"). Never ask for text, logos or flags with writing in the image.
   Nothing from Twilight Struggle.
5. If a card already has a prompt in the file, keep it unless the owner asked to redo it.
6. Report: the file written, the number of prompts, and any card whose art reference was missing.
