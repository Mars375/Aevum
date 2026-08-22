# Monde continu — règles w9

w9 conserve toutes les règles de w8 et introduit un premier progrès qui agit
sur la résolution. Le moteur courant reste w8 tant qu'un monde w9 n'est pas
explicitement créé ; les journaux w8 ne sont donc ni renommés ni réinterprétés.

## Charrues d'acier

- Nom moteur : `steel-ploughs`.
- Seuil : avoir acquis `metallurgy` et disposer d'au moins 300 unités de minerai.
- Effet : rendement agricole multiplié par 1,10 à partir de l'année suivant
  l'acquisition.
- Compromis : rendement minier multiplié par 0,90 pendant les mêmes années, car
  la capacité métallurgique est détournée vers l'outillage agricole.

L'acquisition reste un événement `ADVANCE`. Le progrès porte un nom distinct de
tous les jalons w8 : modifier le sens d'un ancien nom changerait rétrospectivement
les journaux qui le contiennent.
