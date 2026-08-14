import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../state/session_providers.dart';
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
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _CreateAppointmentSheet(
      initialDate: initialDate,
      initialTime: initialTime,
    ),
  );
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
  String? _serviceId;
  String? _clientId;
  String? _staffId;
  late DateTime _date;
  late TimeOfDay _time;
  final _notesController = TextEditingController();
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

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      locale: const Locale('fr', 'FR'),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time,
    );
    if (picked != null) setState(() => _time = picked);
  }

  Future<void> _save() async {
    if (_serviceId == null || _serviceId!.isEmpty) {
      setState(() => _error = 'Choisissez une prestation.');
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
      await ref.read(mobileApiProvider).createAppointment(
            accessToken: token,
            tenantId: tenantId,
            serviceId: _serviceId!,
            startsAt: startsAt.toUtc().toIso8601String(),
            clientId: _clientId,
            staffId: _staffId,
            notes: _notesController.text.trim(),
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
          ),
        )
        .toList();
  }

  List<PickerItem> _clientsToItems(List<PosOption> clients) {
    return clients.map((c) {
      final split = splitLabelWithEmail(c.label);
      return PickerItem(
        id: c.id,
        title: split.title,
        subtitle: split.subtitle,
        searchKeywords: [c.label],
      );
    }).toList();
  }

  List<PickerItem> _staffToItems(List<PosOption> staff) {
    return staff
        .map((s) => PickerItem(id: s.id, title: s.label))
        .toList();
  }

  Future<void> _openServicePicker(List<PosCatalogItem> services) async {
    final picked = await showSearchablePicker(
      context: context,
      title: 'Choisir une prestation',
      items: _servicesToItems(services),
      selectedId: _serviceId,
      searchHint: 'Rechercher une prestation…',
      emptyMessage: 'Aucune prestation trouvée.',
    );
    if (picked != null) setState(() => _serviceId = picked);
  }

  Future<void> _openClientPicker(List<PosOption> clients) async {
    final picked = await showSearchablePicker(
      context: context,
      title: 'Choisir une cliente',
      items: _clientsToItems(clients),
      selectedId: _clientId,
      searchHint: 'Rechercher (nom, email)…',
      nullOption: const PickerItem(id: '__none__', title: 'Sans cliente'),
      emptyMessage: 'Aucune cliente trouvée.',
    );
    if (picked == null) {
      setState(() => _clientId = null);
    } else if (picked != '__none__') {
      setState(() => _clientId = picked);
    }
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
    if (picked == null) {
      setState(() => _staffId = null);
    } else if (picked != '__none__') {
      setState(() => _staffId = picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final posAsync = ref.watch(posContextProvider);
    final dateFmt = DateFormat('EEEE d MMMM', 'fr_FR');
    final timeFmt = DateFormat.Hm();

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 12,
          bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
        ),
        child: posAsync.when(
          loading: () => const SizedBox(
            height: 280,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (e, _) => Text('$e'),
          data: (pos) {
            final services = pos.catalog
                .where((item) => item.type == 'service')
                .toList();

            final selectedService = _serviceId == null
                ? null
                : services.firstWhere(
                    (s) => s.id == _serviceId,
                    orElse: () => PosCatalogItem(
                      key: '',
                      type: 'service',
                      id: _serviceId!,
                      name: '',
                      priceCents: 0,
                      category: 'service',
                    ),
                  );
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
                  const SizedBox(height: 20),
                  const Text(
                    'Nouveau rendez-vous',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: _black,
                    ),
                  ),
                  const SizedBox(height: 20),
                  SearchablePickerField(
                    label: 'Prestation',
                    value: selectedService?.name.isNotEmpty == true
                        ? selectedService!.name
                        : null,
                    placeholder: 'Choisir une prestation',
                    selectedSubtitle: selectedService?.durationMin != null
                        ? '${selectedService!.durationMin} min'
                        : null,
                    onOpen: () => _openServicePicker(services),
                  ),
                  const SizedBox(height: 14),
                  SearchablePickerField(
                    label: 'Cliente',
                    value: selectedClientSplit?.title.isNotEmpty == true
                        ? selectedClientSplit!.title
                        : null,
                    selectedSubtitle: selectedClientSplit?.subtitle,
                    placeholder: 'Sans cliente',
                    onOpen: () => _openClientPicker(pos.clients),
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
                          : const Text('Créer le rendez-vous'),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
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
