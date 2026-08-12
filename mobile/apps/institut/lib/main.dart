import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr_FR');
  Intl.defaultLocale = 'fr_FR';

  final config = AppBuildConfig.fromEnvironment(
    defaultBundleId: 'app.beautyhub.pro',
    defaultAudience: MobileAudience.institut,
  );

  runApp(_BootstrapGate(config: config));
}

class _BootstrapGate extends StatefulWidget {
  const _BootstrapGate({required this.config});

  final AppBuildConfig config;

  @override
  State<_BootstrapGate> createState() => _BootstrapGateState();
}

class _BootstrapGateState extends State<_BootstrapGate> {
  final _client = BootstrapClient();
  MobileBootstrap? _bootstrap;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final bootstrap = await _client.fetch(widget.config);
      await SupabaseBootstrap.ensureInitialized(bootstrap.api);
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
        home: Scaffold(
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Spacer(),
                  const Icon(Icons.cloud_off_outlined, size: 48),
                  const SizedBox(height: 16),
                  const Text(
                    'Connexion impossible',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text('$_error', textAlign: TextAlign.center),
                  const Spacer(),
                  FilledButton(
                    onPressed: () {
                      setState(() {
                        _error = null;
                        _bootstrap = null;
                      });
                      _load();
                    },
                    child: const Text('Réessayer'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    if (_bootstrap == null) {
      return const MaterialApp(
        home: Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return InstitutApp(
      bootstrap: _bootstrap!,
      bundleId: widget.config.bundleId,
    );
  }
}
