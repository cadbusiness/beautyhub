import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';
import '../../widgets/app_sheet.dart';
import '../shared/money.dart';

Future<void> showTeamMemberSheet(
  BuildContext context, {
  required InstStaffMember member,
}) {
  return showAppSheet<void>(
    context: context,
    builder: (context) => TeamMemberSheet(member: member),
  );
}

class TeamMemberSheet extends ConsumerStatefulWidget {
  const TeamMemberSheet({super.key, required this.member});
  final InstStaffMember member;

  @override
  ConsumerState<TeamMemberSheet> createState() => _TeamMemberSheetState();
}

class _TeamMemberSheetState extends ConsumerState<TeamMemberSheet> {
  late final _name = TextEditingController(text: widget.member.fullName);
  late final _email = TextEditingController(text: widget.member.email ?? '');
  late String? _roleId = widget.member.tenantRoleId;
  bool _busy = false;
  String? _revealedPassword;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  InstTeamSnapshot? get _team => ref.read(institutTeamProvider).asData?.value;

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(institutTeamProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enregistré.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<({String token, String tenantId})?> _auth() async {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return null;
    return (token: token, tenantId: tenantId);
  }

  Future<void> _save() async {
    final auth = await _auth();
    if (auth == null) return;
    final caps = _team?.capabilities;
    await _run(() async {
      await ref.read(mobileApiProvider).updateInstitutStaff(
            accessToken: auth.token,
            tenantId: auth.tenantId,
            staffId: widget.member.id,
            fullName: _name.text.trim(),
            email: _email.text.trim().isEmpty ? null : _email.text.trim(),
            tenantRoleId: caps?.canManageRoles == true ? _roleId : null,
          );
    });
  }

  Future<void> _activate({required bool generate}) async {
    final auth = await _auth();
    if (auth == null) return;
    final email = _email.text.trim();
    if (email.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Indiquez un email pour activer le compte.')),
      );
      return;
    }
    final password = generate ? null : await _askPassword();
    if (!generate && password == null) return;
    await _run(() async {
      final revealed = await ref.read(mobileApiProvider).activateInstitutStaff(
            accessToken: auth.token,
            tenantId: auth.tenantId,
            staffId: widget.member.id,
            email: email,
            tenantRoleId: _roleId,
            password: password,
          );
      if (mounted) setState(() => _revealedPassword = revealed);
    });
  }

  Future<void> _resetPassword({required bool generate}) async {
    final auth = await _auth();
    if (auth == null) return;
    final password = generate ? null : await _askPassword();
    if (!generate && password == null) return;
    await _run(() async {
      final revealed = await ref.read(mobileApiProvider).resetInstitutStaffPassword(
            accessToken: auth.token,
            tenantId: auth.tenantId,
            staffId: widget.member.id,
            password: password,
          );
      if (mounted) setState(() => _revealedPassword = revealed);
    });
  }

  Future<void> _invite() async {
    final auth = await _auth();
    if (auth == null) return;
    final email = _email.text.trim();
    if (email.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Indiquez un email pour inviter.')),
      );
      return;
    }
    await _run(() async {
      await ref.read(mobileApiProvider).inviteInstitutStaff(
            accessToken: auth.token,
            tenantId: auth.tenantId,
            staffId: widget.member.id,
            email: email,
            tenantRoleId: _roleId,
          );
    });
  }

  Future<void> _archive({required bool restore}) async {
    final auth = await _auth();
    if (auth == null) return;
    await _run(() async {
      await ref.read(mobileApiProvider).archiveInstitutStaff(
            accessToken: auth.token,
            tenantId: auth.tenantId,
            staffId: widget.member.id,
            restore: restore,
            revokeAccess: !restore,
          );
      if (mounted) Navigator.of(context).pop();
    });
  }

  Future<String?> _askPassword() async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Mot de passe'),
        content: TextField(
          controller: controller,
          obscureText: true,
          decoration: const InputDecoration(
            hintText: '8 caractères minimum',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('Valider'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (result == null || result.trim().length < 8) return null;
    return result.trim();
  }

  @override
  Widget build(BuildContext context) {
    final team = ref.watch(institutTeamProvider).asData?.value;
    final caps = team?.capabilities ?? const InstTeamCapabilities();
    final dash = ref.watch(dashboardProvider).asData?.value;
    DashboardStaffStat? stats;
    if (dash != null) {
      for (final row in dash.byStaff) {
        if (row.staffId == widget.member.id) {
          stats = row;
          break;
        }
      }
    }
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.member.fullName,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0A0A0A),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              [
                widget.member.accessLabel,
                if (widget.member.tenantRoleName != null)
                  widget.member.tenantRoleName!,
              ].join(' · '),
              style: const TextStyle(fontSize: 13, color: Color(0xFF737373)),
            ),
            if (stats != null) ...[
              const SizedBox(height: 16),
              _StatsRow(stats: stats),
            ],
            const SizedBox(height: 16),
            TextField(
              controller: _name,
              enabled: caps.canWriteTeam,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Nom'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _email,
              enabled: caps.canWriteTeam || caps.canManageAccess,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            if (caps.canManageRoles && (team?.roles.isNotEmpty ?? false)) ...[
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                // ignore: deprecated_member_use
                value: _roleId ?? '',
                decoration: const InputDecoration(labelText: 'Rôle'),
                items: [
                  const DropdownMenuItem(value: '', child: Text('Aucun rôle')),
                  for (final role in team!.roles)
                    DropdownMenuItem(value: role.id, child: Text(role.name)),
                ],
                onChanged: _busy
                    ? null
                    : (v) => setState(() => _roleId = (v == null || v.isEmpty) ? null : v),
              ),
            ],
            if (_revealedPassword != null) ...[
              const SizedBox(height: 14),
              _PasswordOnce(password: _revealedPassword!),
            ],
            const SizedBox(height: 16),
            if (caps.canWriteTeam)
              FilledButton(
                onPressed: _busy ? null : _save,
                child: const Text('Enregistrer'),
              ),
            if (caps.canManageAccess) ...[
              const SizedBox(height: 8),
              if (widget.member.accessStatus != 'active')
                OutlinedButton(
                  onPressed: _busy ? null : () => _activate(generate: true),
                  child: const Text('Activer le compte (mot de passe généré)'),
                ),
              if (widget.member.accessStatus != 'active')
                TextButton(
                  onPressed: _busy ? null : () => _activate(generate: false),
                  child: const Text('Activer avec un mot de passe choisi'),
                ),
              if (widget.member.accessStatus == 'active')
                OutlinedButton(
                  onPressed: _busy ? null : () => _resetPassword(generate: true),
                  child: const Text('Nouveau mot de passe généré'),
                ),
              if (widget.member.accessStatus == 'none')
                TextButton(
                  onPressed: _busy ? null : _invite,
                  child: const Text('Envoyer une invitation'),
                ),
              TextButton(
                onPressed: _busy
                    ? null
                    : () => _archive(restore: !widget.member.isActive),
                child: Text(
                  widget.member.isActive ? 'Archiver' : 'Restaurer',
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.stats});
  final DashboardStaffStat stats;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _Stat(label: 'CA', value: formatEuros(stats.revenueCents)),
        _Stat(label: 'Ventes', value: '${stats.salesCount}'),
        _Stat(label: 'Actes', value: '${stats.serviceCount}'),
        _Stat(
          label: 'RDV',
          value: '${stats.appointmentsCompleted}/${stats.appointmentsTotal}',
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
              color: Color(0xFF737373),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0A0A0A),
            ),
          ),
        ],
      ),
    );
  }
}

class _PasswordOnce extends StatelessWidget {
  const _PasswordOnce({required this.password});
  final String password;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Mot de passe (affiché une seule fois)',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF92400E),
            ),
          ),
          const SizedBox(height: 6),
          SelectableText(
            password,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          TextButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: password));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Copié.')),
                );
              }
            },
            child: const Text('Copier'),
          ),
        ],
      ),
    );
  }
}
