import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class InstitutShell extends StatelessWidget {
  const InstitutShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onTap(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: _onTap,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysHide,
        // Les 4 icônes sont choisies pour avoir le même poids visuel :
        // même famille (Material rounded), même densité de traits.
        // On évite `point_of_sale` (trop chargée) et `more_horiz`
        // (visuellement minuscule) qui déséquilibraient la barre.
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Accueil',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month_rounded),
            label: 'Agenda',
          ),
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront_rounded),
            label: 'Caisse',
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded),
            label: 'Plus',
          ),
        ],
      ),
    );
  }
}
