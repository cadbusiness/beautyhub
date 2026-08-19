import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/session_providers.dart';
import '../../widgets/screen_scaffold.dart';
import 'team_member_sheet.dart';

class TeamScreen extends ConsumerWidget {
  const TeamScreen({super.key});

  static const _bg = Color(0xFFF7F7F7);
  static const _muted = Color(0xFF737373);
  static const _black = Color(0xFF0A0A0A);
  static const _border = Color(0xFFEDEDED);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teamAsync = ref.watch(institutTeamProvider);
    return Scaffold(
      backgroundColor: _bg,
      appBar: const InstitutTopBar(
        title: 'Équipe',
        subtitle: 'Personnel, comptes et rôles',
      ),
      floatingActionButton: teamAsync.asData?.value.capabilities.canWriteTeam == true
          ? FloatingActionButton(
              onPressed: () => _createStaff(context, ref),
              backgroundColor: _black,
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(institutTeamProvider);
          ref.invalidate(dashboardProvider);
          await ref.read(institutTeamProvider.future);
        },
        child: teamAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _Error(message: e.toString()),
          data: (snapshot) {
            final members = snapshot.items;
            if (members.isEmpty) {
              return const _Empty();
            }
            final active = members.where((m) => m.isActive).toList();
            final archived = members.where((m) => !m.isActive).toList();
            final caps = snapshot.capabilities;

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.only(
                top: 8,
                bottom: MediaQuery.viewPaddingOf(context).bottom + 88,
              ),
              children: [
                if (caps.canReadAudit)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    child: OutlinedButton.icon(
                      onPressed: () => context.go('/app/more/team/journal'),
                      icon: const Icon(Icons.history, size: 18),
                      label: const Text('Journal des actions'),
                    ),
                  ),
                if (active.isNotEmpty)
                  _Section(
                    title: 'Actives',
                    subtitle:
                        '${active.length} praticienne${active.length > 1 ? "s" : ""}',
                    members: active,
                    onTap: (m) => showTeamMemberSheet(context, member: m),
                  ),
                if (archived.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  _Section(
                    title: 'Archivées',
                    subtitle: '${archived.length} non actives',
                    members: archived,
                    faded: true,
                    onTap: (m) => showTeamMemberSheet(context, member: m),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _createStaff(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nouveau membre'),
        content: TextField(
          controller: controller,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(hintText: 'Nom complet'),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Créer'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (name == null || name.isEmpty) return;
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;
    try {
      await ref.read(mobileApiProvider).createInstitutStaff(
            accessToken: token,
            tenantId: tenantId,
            fullName: name,
          );
      ref.invalidate(institutTeamProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Membre ajouté.')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.subtitle,
    required this.members,
    this.faded = false,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final List<InstStaffMember> members;
  final bool faded;
  final ValueChanged<InstStaffMember> onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: TeamScreen._muted,
                  ),
                ),
              ),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 12, color: TeamScreen._muted),
              ),
            ],
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: TeamScreen._border),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (var i = 0; i < members.length; i++) ...[
                _MemberRow(
                  member: members[i],
                  faded: faded,
                  onTap: () => onTap(members[i]),
                ),
                if (i < members.length - 1)
                  const Divider(
                    height: 1,
                    thickness: 1,
                    color: TeamScreen._border,
                    indent: 68,
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({
    required this.member,
    this.faded = false,
    required this.onTap,
  });
  final InstStaffMember member;
  final bool faded;
  final VoidCallback onTap;

  Color _color() {
    final hex = member.color;
    if (hex == null || hex.isEmpty) return const Color(0xFF64748B);
    try {
      var v = hex.replaceAll('#', '');
      if (v.length == 6) v = 'FF$v';
      return Color(int.parse(v, radix: 16));
    } catch (_) {
      return const Color(0xFF64748B);
    }
  }

  String _initials() {
    final name = member.fullName.trim();
    if (name.isEmpty) return '?';
    final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final color = _color();
    return InkWell(
      onTap: onTap,
      child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      child: Row(
        children: [
          Opacity(
            opacity: faded ? 0.55 : 1,
            child: Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: color.withValues(alpha: 0.3)),
              ),
              child: member.avatarUrl != null && member.avatarUrl!.isNotEmpty
                  ? ClipOval(
                      child: Image.network(
                        member.avatarUrl!,
                        fit: BoxFit.cover,
                        width: 40,
                        height: 40,
                        errorBuilder: (_, _, _) => Text(
                          _initials(),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: color,
                          ),
                        ),
                      ),
                    )
                  : Text(
                      _initials(),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: color,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  member.fullName,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: faded
                        ? const Color(0xFF737373)
                        : TeamScreen._black,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (member.email != null && member.email!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    member.email!,
                    style: const TextStyle(
                      fontSize: 12,
                      color: TeamScreen._muted,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 6),
                Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: [
                    if (member.tenantRoleName != null)
                      InstitutChip(
                        label: member.tenantRoleName!,
                        color: const Color(0xFF1E3A8A),
                        background: const Color(0xFFDBEAFE),
                      ),
                    InstitutChip(
                      label: member.accessLabel,
                      color: member.accessStatus == 'active'
                          ? const Color(0xFF1E40AF)
                          : const Color(0xFF92400E),
                      background: member.accessStatus == 'active'
                          ? const Color(0xFFDBE7FE)
                          : const Color(0xFFFEF3C7),
                    ),
                    if (member.hasSchedule)
                      const InstitutChip(
                        label: 'Planning',
                        icon: Icons.event_available_outlined,
                        color: Color(0xFF065F46),
                        background: Color(0xFFD1FAE5),
                      ),
                    if (!member.isActive)
                      const InstitutChip(
                        label: 'Archivée',
                        color: Color(0xFF525252),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.groups_2_outlined,
              size: 44,
              color: TeamScreen._muted,
            ),
            const SizedBox(height: 12),
            const Text(
              'Aucun membre pour l’instant.',
              style: TextStyle(color: TeamScreen._muted, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13, color: TeamScreen._muted),
        ),
      ],
    );
  }
}
