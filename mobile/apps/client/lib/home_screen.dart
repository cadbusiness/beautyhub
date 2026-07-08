import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';

class ClientHomeScreen extends StatelessWidget {
  const ClientHomeScreen({super.key, required this.bootstrap});

  final MobileBootstrap bootstrap;

  @override
  Widget build(BuildContext context) {
    final tenant = bootstrap.tenant;
    return Scaffold(
      appBar: AppBar(title: Text(bootstrap.appName)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            tenant?.name ?? bootstrap.brand.name,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          const Text('Réserver · Mon compte · Fidélité'),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: () {},
            child: const Text('Prendre rendez-vous'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () {},
            child: const Text('Mon compte'),
          ),
        ],
      ),
    );
  }
}
