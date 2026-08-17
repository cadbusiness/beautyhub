import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';
import '../../widgets/screen_scaffold.dart';
import '../shared/money.dart';
import 'loyalty_labels.dart';
import 'loyalty_sheets.dart';

class LoyaltyScreen extends ConsumerStatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  ConsumerState<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends ConsumerState<LoyaltyScreen> {
  static const _bg = Color(0xFFF5F5F5);
  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE5E5E5);
  static const _rowBg = Colors.white;

  InstLoyaltyAdminSnapshot? _snap;
  bool _loading = true;
  String? _error;
  String? _programId;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  ({String token, String tenantId})? _session() {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return null;
    return (token: token, tenantId: tenantId);
  }

  Future<void> _load({String? programId}) async {
    final session = _session();
    if (session == null) {
      setState(() {
        _loading = false;
        _error = 'Session ou institut manquant';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final snap = await ref.read(mobileApiProvider).fetchLoyaltyAdmin(
            accessToken: session.token,
            tenantId: session.tenantId,
            programId: programId ?? _programId,
          );
      if (!mounted) return;
      setState(() {
        _snap = snap;
        _programId = snap.program.id;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _createProgram() async {
    final name = await showLoyaltyNameSheet(
      context,
      title: 'Nouveau programme',
      hint: 'Fidélité institut',
    );
    if (name == null) return;
    final session = _session();
    if (session == null) return;
    await _run(() async {
      final id = await ref.read(mobileApiProvider).createLoyaltyProgram(
            accessToken: session.token,
            tenantId: session.tenantId,
            name: name,
          );
      _programId = id;
    });
  }

  Future<void> _duplicateProgram() async {
    final snap = _snap;
    if (snap == null) return;
    final name = await showLoyaltyNameSheet(
      context,
      title: 'Dupliquer le programme',
      hint: '${snap.program.name} (copie)',
      initial: '${snap.program.name} (copie)',
    );
    if (name == null) return;
    final session = _session();
    if (session == null) return;
    await _run(() async {
      final id = await ref.read(mobileApiProvider).duplicateLoyaltyProgram(
            accessToken: session.token,
            tenantId: session.tenantId,
            programId: snap.program.id,
            name: name,
          );
      _programId = id;
    });
  }

  Future<void> _toggleActive(bool value) async {
    final snap = _snap;
    final session = _session();
    if (snap == null || session == null) return;
    await _run(() async {
      await ref.read(mobileApiProvider).setLoyaltyProgramActive(
            accessToken: session.token,
            tenantId: session.tenantId,
            programId: snap.program.id,
            isActive: value,
          );
    });
  }

  Future<void> _applyStarter() async {
    final session = _session();
    if (session == null) return;
    await _run(() async {
      await ref.read(mobileApiProvider).applyLoyaltyStarter(
            accessToken: session.token,
            tenantId: session.tenantId,
            programId: _programId,
          );
    });
  }

  Future<void> _deleteRule(InstLoyaltyEarnRule rule) async {
    final ok = await _confirm('Supprimer cette règle de gain ?');
    if (!ok) return;
    final session = _session();
    if (session == null) return;
    await _run(() async {
      await ref.read(mobileApiProvider).deleteLoyaltyRule(
            accessToken: session.token,
            tenantId: session.tenantId,
            ruleId: rule.id,
          );
    });
  }

  Future<void> _deleteReward(InstLoyaltyRewardAdmin reward) async {
    final ok = await _confirm('Supprimer cette récompense ?');
    if (!ok) return;
    final session = _session();
    if (session == null) return;
    await _run(() async {
      await ref.read(mobileApiProvider).deleteLoyaltyReward(
            accessToken: session.token,
            tenantId: session.tenantId,
            rewardId: reward.id,
          );
    });
  }

  Future<bool> _confirm(String message) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirmer'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: _black),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    return result == true;
  }

  String _rewardDetail(InstLoyaltyRewardAdmin reward) {
    switch (reward.rewardType) {
      case 'discount_percent':
        return '−${reward.discountPercent ?? 0} %';
      case 'discount_fixed':
        return '−${formatEuros(reward.discountCents ?? 0)}';
      case 'free_service':
        final match = _snap?.services
            .where((s) => s.id == reward.serviceId)
            .firstOrNull;
        return match?.name ?? 'Prestation offerte';
      default:
        return loyaltyRewardTypeLabel(reward.rewardType);
    }
  }

  @override
  Widget build(BuildContext context) {
    final snap = _snap;
    return Scaffold(
      backgroundColor: _bg,
      appBar: InstitutTopBar(
        title: 'Fidélité',
        subtitle: snap?.program.name,
        trailing: IconButton(
          onPressed: _createProgram,
          icon: const Icon(Icons.add_rounded),
          tooltip: 'Nouveau programme',
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(),
        child: _loading && snap == null
            ? const Center(child: CircularProgressIndicator())
            : _error != null && snap == null
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: _muted),
                        ),
                      ),
                    ],
                  )
                : ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: EdgeInsets.fromLTRB(
                      16,
                      12,
                      16,
                      MediaQuery.viewPaddingOf(context).bottom + 32,
                    ),
                    children: [
                      if (_busy) const LinearProgressIndicator(minHeight: 2),
                      _ProgramCard(
                        snap: snap!,
                        onSelect: (id) => _load(programId: id),
                        onDuplicate: _duplicateProgram,
                        onToggle: _toggleActive,
                      ),
                      const SizedBox(height: 16),
                      _WhiteGroup(
                        title: 'Synthèse',
                        children: [
                          _InfoLine(
                            title: '${snap.clientsWithPoints} clientes',
                            subtitle:
                                '${snap.totalPointsOutstanding} ${snap.program.pointsLabel} en circulation',
                          ),
                        ],
                      ),
                      if (snap.rules.isEmpty && snap.rewards.isEmpty) ...[
                        const SizedBox(height: 16),
                        _WhiteGroup(
                          title: 'Démarrage',
                          children: [
                            _ActionLine(
                              title: 'Modèle institut',
                              subtitle: '10 pts / visite, −10 % à 100 pts',
                              onTap: _applyStarter,
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 16),
                      _WhiteGroup(
                        title: 'Gain de points',
                        trailing: TextButton(
                          onPressed: () async {
                            final ok = await showLoyaltyRuleSheet(
                              context,
                              ref,
                              programId: snap.program.id,
                              wooConnected: snap.wooConnected,
                            );
                            if (ok) _load();
                          },
                          child: const Text('Ajouter'),
                        ),
                        children: [
                          if (snap.rules.isEmpty)
                            const _InfoLine(
                              title: 'Aucune règle',
                              subtitle: 'Ajoutez une règle pour créditer des points.',
                            )
                          else
                            for (final rule in snap.rules)
                              _ActionLine(
                                title: rule.name,
                                subtitle:
                                    '${loyaltySourceLabel(rule.sourceType)} · ${loyaltyRuleEarning(rule.calcMode, rule.pointsValue)}${rule.isActive ? '' : ' · inactif'}',
                                onTap: () async {
                                  final ok = await showLoyaltyRuleSheet(
                                    context,
                                    ref,
                                    programId: snap.program.id,
                                    wooConnected: snap.wooConnected,
                                    rule: rule,
                                  );
                                  if (ok) _load();
                                },
                                onLongPress: () => _deleteRule(rule),
                              ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _WhiteGroup(
                        title: 'Récompenses',
                        trailing: TextButton(
                          onPressed: () async {
                            final ok = await showLoyaltyRewardSheet(
                              context,
                              ref,
                              programId: snap.program.id,
                              services: snap.services,
                            );
                            if (ok) _load();
                          },
                          child: const Text('Ajouter'),
                        ),
                        children: [
                          if (snap.rewards.isEmpty)
                            const _InfoLine(
                              title: 'Aucune récompense',
                              subtitle:
                                  'Les points s’échangent en caisse lors du paiement.',
                            )
                          else
                            for (final reward in snap.rewards)
                              _ActionLine(
                                title: reward.name,
                                subtitle:
                                    '${_rewardDetail(reward)} · ${reward.pointsCost} ${snap.program.pointsLabel}${reward.isActive ? '' : ' · inactif'}',
                                onTap: () async {
                                  final ok = await showLoyaltyRewardSheet(
                                    context,
                                    ref,
                                    programId: snap.program.id,
                                    services: snap.services,
                                    reward: reward,
                                  );
                                  if (ok) _load();
                                },
                                onLongPress: () => _deleteReward(reward),
                              ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _WhiteGroup(
                        title: 'Réglages',
                        children: [
                          _ActionLine(
                            title: 'Bonus, parrainage, portail',
                            subtitle:
                                'Anniversaire, rebook J+0 et visibilité cliente',
                            onTap: () async {
                              final ok = await showLoyaltySettingsSheet(
                                context,
                                ref,
                                program: snap.program,
                              );
                              if (ok) _load();
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
      ),
    );
  }
}

class _ProgramCard extends StatelessWidget {
  const _ProgramCard({
    required this.snap,
    required this.onSelect,
    required this.onDuplicate,
    required this.onToggle,
  });

  final InstLoyaltyAdminSnapshot snap;
  final ValueChanged<String> onSelect;
  final VoidCallback onDuplicate;
  final ValueChanged<bool> onToggle;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _LoyaltyScreenState._rowBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _LoyaltyScreenState._border),
      ),
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'PROGRAMME',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
              color: _LoyaltyScreenState._muted,
            ),
          ),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: snap.programs.any((p) => p.id == snap.program.id)
                  ? snap.program.id
                  : (snap.programs.isEmpty ? null : snap.programs.first.id),
              isExpanded: true,
              hint: Text(snap.program.name),
              items: [
                if (snap.programs.every((p) => p.id != snap.program.id))
                  DropdownMenuItem(
                    value: snap.program.id,
                    child: Text(snap.program.name),
                  ),
                for (final program in snap.programs)
                  DropdownMenuItem(
                    value: program.id,
                    child: Text(
                      program.isActive
                          ? program.name
                          : '${program.name} (inactif)',
                    ),
                  ),
              ],
              onChanged: (id) {
                if (id != null) onSelect(id);
              },
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'Programme actif',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
            value: snap.program.isActive,
            onChanged: onToggle,
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: onDuplicate,
              child: const Text('Dupliquer'),
            ),
          ),
        ],
      ),
    );
  }
}

class _WhiteGroup extends StatelessWidget {
  const _WhiteGroup({
    required this.title,
    required this.children,
    this.trailing,
  });

  final String title;
  final List<Widget> children;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: _LoyaltyScreenState._muted,
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: _LoyaltyScreenState._rowBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _LoyaltyScreenState._border),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.title, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: _LoyaltyScreenState._black,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              subtitle!,
              style: const TextStyle(
                fontSize: 12,
                color: _LoyaltyScreenState._muted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ActionLine extends StatelessWidget {
  const _ActionLine({
    required this.title,
    required this.onTap,
    this.subtitle,
    this.onLongPress,
  });

  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: _LoyaltyScreenState._black,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: _LoyaltyScreenState._muted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFFB5B5B5),
            ),
          ],
        ),
      ),
    );
  }
}
