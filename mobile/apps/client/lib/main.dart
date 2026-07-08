import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';

import 'home_screen.dart';

void main() {
  final config = AppBuildConfig.fromEnvironment(
    defaultBundleId: 'app.beautyhub.client',
    defaultAudience: MobileAudience.client,
  );
  runApp(
    BootstrapApp(
      config: config,
      homeBuilder: (context, bootstrap) => ClientHomeScreen(bootstrap: bootstrap),
    ),
  );
}
