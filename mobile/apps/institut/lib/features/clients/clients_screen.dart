import 'dart:async';

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';
import '../../widgets/screen_scaffold.dart';
import 'client_detail_sheet.dart';

class ClientsScreen extends ConsumerStatefulWidget {
  const ClientsScreen({super.key});

  @override
  ConsumerState<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends ConsumerState<ClientsScreen> {
  static const _bg = Color(0xFFF7F7F7);
  static const _muted = Color(0xFF737373);
  static const _rowBg = Colors.white;
  static const _border = Color(0xFFEDEDED);

  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  Timer? _debounce;
  String _query = '';
  List<InstClient> _items = const [];
  String? _cursor;
  bool _loading = false;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadInitial());
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final pos = _scrollController.position;
    if (pos.pixels >= pos.maxScrollExtent - 320 &&
        !_loadingMore &&
        _cursor != null) {
      _loadMore();
    }
  }

  Future<void> _loadInitial() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = ref.read(accessTokenProvider);
      final tenantId = ref.read(selectedTenantIdProvider);
      if (token == null || tenantId == null) {
        throw StateError('Session ou institut manquant');
      }
      final page = await ref.read(mobileApiProvider).fetchInstitutClients(
            accessToken: token,
            tenantId: tenantId,
            query: _query,
          );
      if (!mounted) return;
      setState(() {
        _items = page.items;
        _cursor = page.nextCursor;
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

  Future<void> _loadMore() async {
    if (_loadingMore || _cursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final token = ref.read(accessTokenProvider);
      final tenantId = ref.read(selectedTenantIdProvider);
      if (token == null || tenantId == null) return;
      final page = await ref.read(mobileApiProvider).fetchInstitutClients(
            accessToken: token,
            tenantId: tenantId,
            query: _query,
            cursor: _cursor,
          );
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...page.items];
        _cursor = page.nextCursor;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  void _onQueryChanged(String v) {
    setState(() => _query = v);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 320), _loadInitial);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: InstitutTopBar(
        title: 'Clientes',
        subtitle: _items.isEmpty
            ? null
            : '${_items.length}${_cursor != null ? '+' : ''} au total',
        bottom: InstitutSearchBar(
          controller: _searchController,
          onChanged: _onQueryChanged,
          hint: 'Nom, email, téléphone…',
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: _muted, fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _loadInitial,
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
      );
    }
    if (_items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.people_outline_rounded,
                size: 44,
                color: _muted,
              ),
              const SizedBox(height: 12),
              Text(
                _query.isEmpty
                    ? 'Aucune cliente pour le moment.'
                    : 'Aucun résultat pour “$_query”.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: _muted, fontSize: 14),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadInitial,
      child: ListView.separated(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.only(
          top: 4,
          bottom: MediaQuery.viewPaddingOf(context).bottom + 24,
        ),
        itemCount: _items.length + (_loadingMore ? 1 : 0),
        separatorBuilder: (_, index) => const Divider(
          height: 1,
          thickness: 1,
          color: _border,
          indent: 68,
        ),
        itemBuilder: (context, index) {
          if (index >= _items.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            );
          }
          final client = _items[index];
          return _ClientRow(
            client: client,
            onTap: () => _openDetail(client),
          );
        },
      ),
    );
  }

  Future<void> _openDetail(InstClient client) async {
    await showClientDetailSheet(context: context, client: client);
  }
}

class _ClientRow extends StatelessWidget {
  const _ClientRow({required this.client, required this.onTap});

  final InstClient client;
  final VoidCallback onTap;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  String _initials() {
    final name = client.fullName ?? client.email ?? client.phone ?? '?';
    if (name.isEmpty) return '?';
    final trimmed = name.trim();
    if (trimmed.contains(' ')) {
      final parts = trimmed.split(' ').where((p) => p.isNotEmpty).toList();
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
    }
    return trimmed[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _ClientsScreenState._rowBg,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _Avatar(initials: _initials()),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      client.displayName,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: _black,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (client.subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        client.subtitle!,
                        style: const TextStyle(fontSize: 12, color: _muted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (client.tags.isNotEmpty ||
                        client.marketingOptIn ||
                        client.hasAccount) ...[
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: [
                          if (client.hasAccount)
                            const InstitutChip(
                              label: 'Compte',
                              icon: Icons.badge_outlined,
                              color: Color(0xFF1E40AF),
                              background: Color(0xFFDBE7FE),
                            ),
                          if (client.marketingOptIn)
                            const InstitutChip(
                              label: 'Marketing',
                              icon: Icons.mail_outline_rounded,
                              color: Color(0xFF065F46),
                              background: Color(0xFFD1FAE5),
                            ),
                          ...client.tags.take(3).map(
                                (t) => InstitutChip(label: t),
                              ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFFB5B5B5),
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.initials});
  final String initials;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F1F1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        initials,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: _ClientRow._black,
        ),
      ),
    );
  }
}
