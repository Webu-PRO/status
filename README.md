# Webu Státusz

Valós idejű státuszoldal a Webu infrastruktúra és ügyféloldalak monitorozásához.

**Státuszoldal:** https://status.webu.hu
**Motor:** [Upptime](https://upptime.js.org) — GitHub Actions, 5 percenkénti ellenőrzés, kiesési incidensek GitHub Issues-ként

## Monitorozott csoportok

| Csoport                                                                      | Komponensek                                  |
| ---------------------------------------------------------------------------- | -------------------------------------------- |
| Webu                                                                         | főoldal (karbantartás), API, admin, CMR, SEO |
| Kollár Ortopédia                                                             | főoldal, foglalási rendszer, admin           |
| Koronakert                                                                   | admin, Medusa, keresés, képek                |
| Lifted                                                                       | admin, képek                                 |
| Teherguminet, Compastor, Marva Home, Modulix, Ajtófelújító, Recodee, Volaria | admin / főoldal                              |
| Teszt környezetek                                                            | trusbau, mite, lebenyse, gotto-admin         |

## Értesítések

- **Atom feed:** https://github.com/Webu-PRO/status/issues.atom
- **Incidensek:** https://github.com/Webu-PRO/status/issues?q=label%3Astatus
- **ntfy.sh:** push értesítés kieséskor / megoldáskor (NTFY_TOPIC secret szükséges)

## Hiba bejelentése

[Új issue megnyitása](https://github.com/Webu-PRO/status/issues/new)

## Fejlesztés

A frontend (`docs/`) egyedi, a Polymarket-stílusú design alapján készült.
Az Upptime automatikusan frissíti a `history/` és `api/` mappákat.

A `site.yml` és `update-template.yml` automatikus ütemezése le van tiltva —
a saját `docs/` és workflowök védelme érdekében.
Manuális template-frissítés: workflow_dispatch → `Update Template CI` → diff ellenőrzés.
