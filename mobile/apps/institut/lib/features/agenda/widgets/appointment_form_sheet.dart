import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../state/session_providers.dart';
import '../../../widgets/client_picker.dart';
import '../../../widgets/new_client_form.dart';
import '../../../widgets/searchable_picker.dart';

Future<void> showCreateAppointmentSheet(
  BuildContext context,
  WidgetRef ref, {
  DateTime? initialDate,
  TimeOfDay? initialTime,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(ctx).height * 0.92,
        ),
        child: _CreateAppointmentSheet(
          initialDate: initialDate,
          initialTime: initialTime,
        ),
      ),
    ),
  );
}

class _ServiceLine {
  String? serviceId;
  List<ServiceExtraConfig> catalog = const [];
  Map<String, int> extraQty = {};
  bool loadingExtras = false;
  String? extrasError;
}

class _CreateAppointmentSheet extends ConsumerStatefulWidget {
  const _CreateAppointmentSheet({
    this.initialDate,
    this.initialTime,
  });

  final DateTime? initialDate;
  final TimeOfDay? initialTime;

  @override
  ConsumerState<_CreateAppointmentSheet> createState() =>
      _CreateAppointmentSheetState();
}

class _CreateAppointmentSheetState
    extends ConsumerState<_CreateAppointmentSheet> {
  final List<_ServiceLine> _lines = [_ServiceLine()];
  String? _clientId;
  String? _clientTitle;
  String? _clientSubtitle;
  String? _staffId;
  late DateTime _date;
  late TimeOfDay _time;
  final _notesController = TextEditingController();
  String _recurrence = 'none';
  DateTime? _until;
  bool _untilManual = false;
  bool _saving = false;
  String? _error;

  static const _black = Color(0xFF0A0A0A);
  static const _border = Color(0xFFE5E5E5);

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _date = widget.initialDate ?? DateTime(now.year, now.month, now.day);
    _time = widget.initialTime ??
        TimeOfDay(hour: now.hour, minute: (now.minute ~/ 15 + 1) * 15 % 60);
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  List<PosCatalogItem> _catalogServices(PosContext pos) {
    return pos.catalog
        .where(
          (item) => item.type == 'service' && item.visibility != 'extra_only',
        )
        .toList();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      locale: const Locale('fr', 'FR'),
    );
    if (picked == null) return;
    setState(() {
      _date = picked;
      if (_recurrence != 'none' && !_untilManual) {
        _until = _defaultUntil(_recurrence);
      } else if (_until != null && _until!.isBefore(_date)) {
        _until = _defaultUntil(_recurrence);
        _untilManual = false;
      }
    });
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time,
    );
    if (picked != null) setState(() => _time = picked);
  }

  Future<void> _pickUntil() async {
    final initial = _until ?? _defaultUntil(_recurrence);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: _date,
      lastDate: DateTime.now().add(const Duration(days: 400)),
      locale: const Locale('fr', 'FR'),
    );
    if (picked != null) {
      setState(() {
        _until = picked;
        _untilManual = true;
      });
    }
  }

  DateTime _addMonths(DateTime source, int months) {
    final day = source.day;
    final cursor = DateTime(source.year, source.month + months, 1);
    final lastDay = DateTime(cursor.year, cursor.month + 1, 0).day;
    return DateTime(cursor.year, cursor.month, day > lastDay ? lastDay : day);
  }

  DateTime _defaultUntil(String frequency) {
    switch (frequency) {
      case 'weekly':
        return _date.add(const Duration(days: 7 * 12));
      case 'biweekly':
        return _date.add(const Duration(days: 14 * 6));
      case 'monthly':
        return _addMonths(_date, 6);
      default:
        return _date.add(const Duration(days: 90));
    }
  }

  DateTime _nextOccurrence(String frequency) {
    switch (frequency) {
      case 'weekly':
        return _date.add(const Duration(days: 7));
      case 'biweekly':
        return _date.add(const Duration(days: 14));
      case 'monthly':
        return _addMonths(_date, 1);
      default:
        return _date;
    }
  }

  int _occurrenceCount(String frequency, DateTime until) {
    var count = 1;
    var cursor = _date;
    const max = 52;
    while (count < max) {
      if (frequency == 'weekly') {
        cursor = cursor.add(const Duration(days: 7));
      } else if (frequency == 'biweekly') {
        cursor = cursor.add(const Duration(days: 14));
      } else if (frequency == 'monthly') {
        cursor = _addMonths(cursor, 1);
      } else {
        return count;
      }
      if (cursor.isAfter(until)) break;
      count++;
    }
    return count;
  }

  void _setRecurrence(String frequency) {
    setState(() {
      _recurrence = frequency;
      _untilManual = false;
      _until = frequency == 'none' ? null : _defaultUntil(frequency);
    });
  }

  Future<void> _loadExtras(_ServiceLine line) async {
    final serviceId = line.serviceId;
    if (serviceId == null || serviceId.isEmpty) {
      setState(() {
        line.catalog = const [];
        line.extraQty = {};
        line.loadingExtras = false;
        line.extrasError = null;
      });
      return;
    }
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() {
      line.loadingExtras = true;
      line.extrasError = null;
    });
    try {
      final catalog = await ref.read(mobileApiProvider).fetchServiceExtras(
            accessToken: token,
            tenantId: tenantId,
            serviceId: serviceId,
          );
      if (!mounted) return;
      final qty = <String, int>{};
      for (final extra in catalog) {
        if (extra.minQty > 0) qty[extra.extraServiceId] = extra.minQty;
      }
      setState(() {
        line.catalog = catalog;
        line.extraQty = qty;
        line.loadingExtras = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        line.catalog = const [];
        line.extraQty = {};
        line.loadingExtras = false;
        line.extrasError = 'Impossible de charger les extras.';
      });
    }
  }

  Future<void> _save() async {
    final filled = _lines.where((l) => l.serviceId != null && l.serviceId!.isNotEmpty).toList();
    if (filled.isEmpty) {
      setState(() => _error = 'Choisissez au moins une prestation.');
      return;
    }

    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    final startsAt = DateTime(
      _date.year,
      _date.month,
      _date.day,
      _time.hour,
      _time.minute,
    );

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final lines = filled
          .map(
            (line) => AppointmentLineInput(
              serviceId: line.serviceId!,
              extras: line.extraQty.entries
                  .where((e) => e.value > 0)
                  .map(
                    (e) => BookingExtraLine(serviceId: e.key, quantity: e.value),
                  )
                  .toList(),
              staffId: _staffId,
            ),
          )
          .toList();
      await ref.read(mobileApiProvider).createAppointment(
            accessToken: token,
            tenantId: tenantId,
            startsAt: startsAt.toUtc().toIso8601String(),
            clientId: _clientId,
            staffId: _staffId,
            notes: _notesController.text.trim(),
            lines: lines,
            recurrenceFrequency: _recurrence,
            recurrenceUntil: _recurrence == 'none' || _until == null
                ? null
                : DateFormat('yyyy-MM-dd').format(_until!),
          );
      ref.invalidate(dayAgendaProvider);
      ref.invalidate(todayAgendaProvider);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  List<PickerItem> _servicesToItems(List<PosCatalogItem> services) {
    return services
        .map(
          (s) => PickerItem(
            id: s.id,
            title: s.name,
            subtitle: s.priceCents > 0
                ? '${(s.priceCents / 100).toStringAsFixed(2)} €'
                : null,
            trailing: s.durationMin != null ? '${s.durationMin} min' : null,
            groupId: s.serviceCategoryId?.isNotEmpty == true
                ? s.serviceCategoryId
                : '__none__',
            groupLabel: s.serviceCategoryName?.trim().isNotEmpty == true
                ? s.serviceCategoryName
                : 'Sans catégorie',
          ),
        )
        .toList();
  }

  List<PickerItem> _staffToItems(List<PosOption> staff) {
    return staff.map((s) => PickerItem(id: s.id, title: s.label)).toList();
  }

  Future<void> _openServicePicker(
    List<PosCatalogItem> services,
    _ServiceLine line,
  ) async {
    final picked = await showSearchablePicker(
      context: context,
      title: 'Choisir une prestation',
      items: _servicesToItems(services),
      selectedId: line.serviceId,
      searchHint: 'Rechercher une prestation…',
      emptyMessage: 'Aucune prestation trouvée.',
    );
    if (picked == null) return;
    setState(() {
      line.serviceId = picked.id;
      line.catalog = const [];
      line.extraQty = {};
    });
    await _loadExtras(line);
  }

  Future<void> _openClientPicker() async {
    final picked = await showSearchablePicker(
      context: context,
      title: 'Choisir une cliente',
      items: const [],
      search: (q, {fromLetter}) => searchInstitutClients(
        ref,
        q,
        fromLetter: fromLetter,
      ),
      showAlphabet: true,
      selectedId: _clientId,
      searchHint: 'Rechercher (nom, email, téléphone)…',
      nullOption: const PickerItem(id: '__none__', title: 'Sans cliente'),
      emptyMessage: 'Aucune cliente trouvée.',
      createAction: newClientPickerAction(ref),
    );
    if (picked == null) return;
    setState(() {
      if (picked.id == '__none__') {
        _clientId = null;
        _clientTitle = null;
        _clientSubtitle = null;
      } else {
        _clientId = picked.id;
        _clientTitle = picked.title;
        _clientSubtitle = picked.subtitle;
      }
    });
  }

  Future<void> _openStaffPicker(List<PosOption> staff) async {
    final picked = await showSearchablePicker(
      context: context,
      title: 'Choisir une praticienne',
      items: _staffToItems(staff),
      selectedId: _staffId,
      searchHint: 'Rechercher…',
      nullOption: const PickerItem(id: '__none__', title: 'Non assignée'),
      emptyMessage: 'Aucune praticienne trouvée.',
    );
    if (picked == null) return;
    setState(() {
      _staffId = picked.id == '__none__' ? null : picked.id;
    });
  }

  @override
  Widget build(BuildContext context) {
    final posAsync = ref.watch(posContextProvider);
    final dateFmt = DateFormat('EEEE d MMMM', 'fr_FR');
    final timeFmt = DateFormat.Hm();
    final untilFmt = DateFormat('d MMMM y', 'fr_FR');

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      child: posAsync.when(
          loading: () => const SizedBox(
            height: 280,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (e, _) => Text('$e'),
          data: (pos) {
            final services = _catalogServices(pos);
            final untilDate = _until ?? _defaultUntil(_recurrence);
            final nextDate = _nextOccurrence(_recurrence);
            final occurrenceCount = _occurrenceCount(_recurrence, untilDate);
            final selectedClient = _clientId == null
                ? null
                : pos.clients.firstWhere(
                    (c) => c.id == _clientId,
                    orElse: () => PosOption(id: _clientId!, label: ''),
                  );
            final selectedClientSplit = selectedClient == null
                ? null
                : splitLabelWithEmail(selectedClient.label);
            final selectedStaff = _staffId == null
                ? null
                : pos.staff.firstWhere(
                    (s) => s.id == _staffId,
                    orElse: () => PosOption(id: _staffId!, label: ''),
                  );

            return SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Center(
                    child: Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: _border,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Nouveau rendez-vous',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: _black,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: _saving ? null : () => Navigator.pop(context),
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(Icons.close_rounded, size: 22),
                        color: const Color(0xFF737373),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SearchablePickerField(
                    label: 'Cliente',
                    value: _clientTitle ??
                        (selectedClientSplit?.title.isNotEmpty == true
                            ? selectedClientSplit!.title
                            : null),
                    selectedSubtitle: _clientSubtitle ?? selectedClientSplit?.subtitle,
                    placeholder: 'Sans cliente',
                    onOpen: _openClientPicker,
                  ),
                  const SizedBox(height: 14),
                  SearchablePickerField(
                    label: 'Praticienne',
                    value: selectedStaff?.label.isNotEmpty == true
                        ? selectedStaff!.label
                        : null,
                    placeholder: 'Non assignée',
                    onOpen: () => _openStaffPicker(pos.staff),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const _FieldLabel('Date'),
                            const SizedBox(height: 8),
                            OutlinedButton(
                              onPressed: _pickDate,
                              style: _outlineStyle(),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  dateFmt.format(_date),
                                  style: const TextStyle(color: _black),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const _FieldLabel('Heure'),
                            const SizedBox(height: 8),
                            OutlinedButton(
                              onPressed: _pickTime,
                              style: _outlineStyle(),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  timeFmt.format(DateTime(
                                    _date.year,
                                    _date.month,
                                    _date.day,
                                    _time.hour,
                                    _time.minute,
                                  )),
                                  style: const TextStyle(color: _black),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  for (var i = 0; i < _lines.length; i++) ...[
                    _buildServiceLine(services, _lines[i], i),
                    const SizedBox(height: 12),
                  ],
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () => setState(() => _lines.add(_ServiceLine())),
                      child: const Text('+ Ajouter une prestation'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const _FieldLabel('Récurrence'),
                  const SizedBox(height: 8),
                  InputDecorator(
                    decoration: _inputDecoration(),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _recurrence,
                        isExpanded: true,
                        items: const [
                          DropdownMenuItem(value: 'none', child: Text('Ne pas répéter')),
                          DropdownMenuItem(value: 'weekly', child: Text('Toutes les semaines')),
                          DropdownMenuItem(
                            value: 'biweekly',
                            child: Text('Toutes les 2 semaines'),
                          ),
                          DropdownMenuItem(value: 'monthly', child: Text('Tous les mois')),
                        ],
                        onChanged: (value) => _setRecurrence(value ?? 'none'),
                      ),
                    ),
                  ),
                  if (_recurrence != 'none') ...[
                    const SizedBox(height: 12),
                    const _FieldLabel('Jusqu’au'),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: _pickUntil,
                      style: _outlineStyle(),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          untilFmt.format(untilDate),
                          style: const TextStyle(color: _black),
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Prochaine le ${untilFmt.format(nextDate)} · $occurrenceCount rendez-vous',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF737373)),
                    ),
                  ],
                  const SizedBox(height: 14),
                  const _FieldLabel('Notes'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _notesController,
                    decoration: _inputDecoration(hint: 'Optionnel'),
                    maxLines: 2,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Color(0xFFDC2626))),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 52,
                    child: FilledButton(
                      onPressed: _saving ? null : _save,
                      style: FilledButton.styleFrom(
                        backgroundColor: _black,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              _recurrence != 'none' || _lines.length > 1
                                  ? 'Créer les rendez-vous'
                                  : 'Créer le rendez-vous',
                            ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      );
  }

  Widget _buildServiceLine(
    List<PosCatalogItem> services,
    _ServiceLine line,
    int index,
  ) {
    final selectedService = line.serviceId == null
        ? null
        : services.cast<PosCatalogItem?>().firstWhere(
              (s) => s?.id == line.serviceId,
              orElse: () => null,
            );
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Prestation ${index + 1}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _black,
                  ),
                ),
              ),
              if (_lines.length > 1)
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: () => setState(() => _lines.removeAt(index)),
                  icon: const Icon(Icons.close, size: 18),
                ),
            ],
          ),
          SearchablePickerField(
            label: 'Prestation',
            value: selectedService?.name.isNotEmpty == true
                ? selectedService!.name
                : null,
            placeholder: 'Choisir une prestation',
            selectedSubtitle: selectedService?.durationMin != null
                ? '${selectedService!.durationMin} min'
                : null,
            onOpen: () => _openServicePicker(services, line),
          ),
          if (line.loadingExtras) ...[
            const SizedBox(height: 10),
            const Text(
              'Chargement des extras…',
              style: TextStyle(fontSize: 12, color: Color(0xFF737373)),
            ),
          ] else if (line.extrasError != null) ...[
            const SizedBox(height: 10),
            Text(
              line.extrasError!,
              style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
            ),
          ] else if (line.serviceId != null && line.catalog.isEmpty) ...[
            const SizedBox(height: 10),
            const Text(
              'Aucun extra pour cette prestation.',
              style: TextStyle(fontSize: 12, color: Color(0xFFA3A3A3)),
            ),
          ] else if (line.catalog.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text(
              'Extras',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF404040),
              ),
            ),
            const SizedBox(height: 8),
            for (final extra in line.catalog)
              _ExtraRow(
                extra: extra,
                quantity: line.extraQty[extra.extraServiceId] ?? 0,
                onChanged: (qty) {
                  setState(() {
                    if (qty <= 0) {
                      line.extraQty.remove(extra.extraServiceId);
                    } else {
                      line.extraQty[extra.extraServiceId] = qty;
                    }
                  });
                },
              ),
          ],
        ],
      ),
    );
  }

  InputDecoration _inputDecoration({String? hint}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 15),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _black, width: 1.4),
      ),
    );
  }

  ButtonStyle _outlineStyle() {
    return OutlinedButton.styleFrom(
      foregroundColor: _black,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      side: const BorderSide(color: _border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    );
  }
}

class _ExtraRow extends StatelessWidget {
  const _ExtraRow({
    required this.extra,
    required this.quantity,
    required this.onChanged,
  });

  final ServiceExtraConfig extra;
  final int quantity;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  extra.name,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF0A0A0A),
                  ),
                ),
                Text(
                  '${extra.durationMin} min · ${(extra.priceCents / 100).toStringAsFixed(2)} €',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF737373)),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: quantity <= extra.minQty
                ? null
                : () => onChanged(quantity - 1),
            icon: const Icon(Icons.remove_circle_outline, size: 20),
          ),
          Text(
            '$quantity',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          IconButton(
            onPressed: quantity >= extra.maxQty
                ? null
                : () => onChanged(quantity + 1),
            icon: const Icon(Icons.add_circle_outline, size: 20),
          ),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: Color(0xFF404040),
      ),
    );
  }
}
