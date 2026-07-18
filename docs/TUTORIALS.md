# Tutorial and Learning Architecture

## Product model

The learning system teaches the application as one connected lifecycle:

`Business -> Clients -> Projects -> Hours and Expenses -> Invoices -> Payments -> Insights`

First-time onboarding introduces that model, asks whether the account is a sole trader or employer, then requires the user to complete a real client, project, time entry, and invoice draft. The reusable learning centre remains available under **More > Tutorials**.

## Main parts

- `src/lib/tutorials.ts` is the typed tutorial catalogue and the only place tutorial content should be defined.
- `src/components/TutorialLibrary.tsx` supplies search, categories, status filters, cards, the walkthrough player, animated demonstrations, transcripts, and responsive behaviour.
- `src/app/tutorials/actions.ts` securely saves progress for the authenticated owner.
- `TutorialProgress` stores one row per owner and tutorial key. It is server-only, RLS-enabled, and unavailable to Supabase browser API roles.
- `LearnHowLink` deep-links a product page to a relevant guide.

## Progress states

- **Not started**: no database row exists.
- **In progress**: a row records the last visited step.
- **Completed**: completion time and final step are recorded.

Opening a new tutorial creates progress. Moving between steps updates the saved position. A completed tutorial can be replayed without losing its status or explicitly restarted to return it to in progress.

## Demonstrations and accessibility

Demonstrations are small recreations of the actual product workflow rather than stock media. They are driven by the catalogue's `demoFrames`, can be paused or replayed, and include text transcripts. Automatic motion stops when the operating system requests reduced motion.

The player supports touch, keyboard-accessible controls, Escape to close, Alt + arrow step navigation, labelled progress indicators, screen-reader descriptions, and a mobile bottom-sheet layout.

## Adding a tutorial

1. Add one `TutorialDefinition` to `src/lib/tutorials.ts` with a unique stable key.
2. Use an existing category and icon name.
3. Explain purpose, timing, outcome, steps, keywords, and focused demonstration frames.
4. Add a contextual `LearnHowLink` where the guide resolves a likely question.
5. Update the catalogue test if a new content rule is introduced.

Do not create independent tutorial pages. Keeping content in the catalogue preserves search, progress, accessibility, role filtering, deep links, and future media support automatically.

## Future media

The catalogue can be extended with optional captioned video, image, or GIF fields without changing progress storage. Before adding hosted media, define storage ownership, retention, captions, transcripts, download size limits, and a reduced-data fallback. Short in-product demonstrations remain the default because they are fast, accessible, theme-consistent, and less likely to become visually stale.
