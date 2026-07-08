import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';

class InstitutHomeScreen extends StatelessWidget {
  const InstitutHomeScreen({super.key, required this.bootstrap});

  final MobileBootstrap bootstrap;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(bootstrap.appName)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Espace équipe',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text('Marque : ${bootstrap.brand.name}'),
          if (bootstrap.tenant != null) Text('Institut : ${bootstrap.tenant!.name}'),
          const SizedBox(height: 16),
          Text(
            'Modules actifs',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          ...bootstrap.features.modules.map(
            (module) => ListTile(
              leading: const Icon(Icons.extension_outlined),
              title: Text(module),
              dense: true,
            ),
          ),
          if (bootstrap.features.modules.isEmpty)
            const Text('Aucun module (scope brand — sélection institut à venir).'),
        ],
      ),
    );
  }
}
