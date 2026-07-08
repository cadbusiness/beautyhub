import 'package:flutter/material.dart';

import '../api/bootstrap_client.dart';
import '../config/app_build_config.dart';
import '../models/mobile_bootstrap.dart';
import '../theme/branding_theme.dart';

/// Écran de démarrage : charge le bootstrap marque blanche puis affiche [homeBuilder].
class BootstrapApp extends StatefulWidget {
  const BootstrapApp({
    super.key,
    required this.config,
    required this.homeBuilder,
    this.loadingBuilder,
  });

  final AppBuildConfig config;
  final Widget Function(BuildContext context, MobileBootstrap bootstrap) homeBuilder;
  final WidgetBuilder? loadingBuilder;

  @override
  State<BootstrapApp> createState() => _BootstrapAppState();
}

class _BootstrapAppState extends State<BootstrapApp> {
  late final BootstrapClient _client;
  MobileBootstrap? _bootstrap;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _client = BootstrapClient();
    _load();
  }

  Future<void> _load() async {
    try {
      final bootstrap = await _client.fetch(widget.config);
      if (!mounted) return;
      setState(() {
        _bootstrap = bootstrap;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  @override
  void dispose() {
    _client.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return MaterialApp(
        home: _BootstrapErrorView(
          error: _error!,
          config: widget.config,
          onRetry: () {
            setState(() {
              _error = null;
              _bootstrap = null;
            });
            _load();
          },
        ),
      );
    }

    if (_bootstrap == null) {
      return MaterialApp(
        home: widget.loadingBuilder?.call(context) ?? const _BootstrapLoadingView(),
      );
    }

    final bootstrap = _bootstrap!;
    return MaterialApp(
      title: bootstrap.appName,
      theme: themeFromBranding(bootstrap.branding),
      home: widget.homeBuilder(context, bootstrap),
    );
  }
}

class _BootstrapLoadingView extends StatelessWidget {
  const _BootstrapLoadingView();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Chargement…'),
          ],
        ),
      ),
    );
  }
}

class _BootstrapErrorView extends StatelessWidget {
  const _BootstrapErrorView({
    required this.error,
    required this.config,
    required this.onRetry,
  });

  final Object error;
  final AppBuildConfig config;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Icon(Icons.cloud_off_outlined, size: 48),
              const SizedBox(height: 16),
              Text(
                'Connexion impossible',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                error.toString(),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Bundle: ${config.bundleId}\nAPI: ${config.bootstrapBaseUrl}',
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              FilledButton(onPressed: onRetry, child: const Text('Réessayer')),
            ],
          ),
        ),
      ),
    );
  }
}
