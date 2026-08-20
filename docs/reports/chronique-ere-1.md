# Chronique de la première ère — RETIRÉE

Statut : **retirée le 20 août 2026, ses dates étaient fausses**

Ce rapport racontait la chute de crimson : plus grande civilisation du monde
jusqu'à l'an 216, première frontière cédée en 199, siège tombé trois fois,
famine permanente à partir de 229.

Loïc a relevé l'incohérence : comment être la plus grande en 216 si la frontière
cède en 199 ? La vérification lui a donné raison, et le défaut était plus grave
qu'une erreur de rédaction.

## Ce qui n'allait pas

Le journal du monde `monde` porte une décision `INVADED` en l'an 199 et trois
`CAPITAL` en 205, 206 et 224. Mais en rejouant ce même journal, la première
terre perdue par crimson est en **227** et sa première capitale tombe en **250**.
Ces décisions répondent à des évènements qui, dans l'histoire recalculée,
n'existent pas.

La cause : un monde se vit en plusieurs séances, et chaque reprise reconstruit
l'état en rejouant le journal. Un défaut de rejeu — une décision différée
appliquée à l'année où la question avait été posée et non répondue — a été
corrigé **entre deux séances**. Les reprises d'avant le correctif repartaient
donc d'un état qui n'était pas celui qui avait été vécu, et la suite s'est
écrite dessus.

Le journal est un enregistrement de décisions prises dans une histoire, rejouées
dans une autre. Aucune de ses dates n'est fiable.

## Ce que ça a produit de bon

Un garde-fou qui manquait. Un journal porte désormais **l'empreinte du monde à
l'année où il s'est arrêté** (`packages/world/src/fingerprint.ts`). À la
reprise, l'état est recalculé et comparé ; s'ils diffèrent, le runner refuse de
continuer au lieu d'écrire des décisions dans une histoire qui n'a pas eu lieu.

C'est exactement le contrôle qui aurait signalé ce problème à la seconde où il
est apparu, plutôt que trois cents ans plus tard par un lecteur attentif.

Le journal incohérent est conservé sous `worlds/monde-incoherent/` comme pièce
à conviction. Une chronique honnête sera écrite à partir d'un monde vécu d'un
bout à l'autre sous le même moteur.

## La leçon, qui vaut plus que le récit

Ce projet vérifie ses chiffres et refuse ses propres conclusions quand la mesure
les contredit. Il ne vérifiait pas **la continuité de ses données entre deux
séances** — et c'est précisément là que le défaut s'est logé. Une histoire est
une affirmation comme une autre : elle a besoin de son contrôle.
