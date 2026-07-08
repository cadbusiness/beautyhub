import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';

import 'home_screen.dart';

void main() {
  final config = AppBuildConfig.fromEnvironment(
    defaultBundleId: 'app.beautyhub.pro',
    defaultAudience: MobileAudience.institut,
  );
  runApp(
    BootstrapApp(
      config: config,
      homeBuilder: (context, bootstrap) => InstitutHomeScreen(bootstrap: bootstrap),
    ),
  );
}
