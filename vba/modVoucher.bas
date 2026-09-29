Option Explicit
'==========================================================================
'  Cash Payment Voucher engine - enter once on the voucher form, then:
'  save / save+new / print / PDF / open / previous / next / copy / delete
'  Arabic texts are read from the hidden sheet (shSys) so the code stays ASCII.
'==========================================================================

'@@CONSTANTS@@

#If VBA7 Then
Private Declare PtrSafe Function MessageBoxW Lib "user32" (ByVal hWnd As LongPtr, ByVal lpText As LongPtr, ByVal lpCaption As LongPtr, ByVal uType As Long) As Long
#Else
Private Declare Function MessageBoxW Lib "user32" (ByVal hWnd As Long, ByVal lpText As Long, ByVal lpCaption As Long, ByVal uType As Long) As Long
#End If

Private mBusy As Boolean

'----------------------------------------------------------------- helpers
Private Function M(ByVal key As Long) As String
    M = CStr(shSys.Cells(key, 2).Value)
End Function

Private Function Ask(ByVal txt As String) As Boolean
    Dim r As Long
    On Error GoTo Fallback
    r = MessageBoxW(0, StrPtr(txt), StrPtr(M(MSG_TITLE)), &H4& Or &H20& Or &H80000 Or &H100000 Or &H40000)
    Ask = (r = 6)
    Exit Function
Fallback:
    Ask = (MsgBox(txt, vbYesNo + vbQuestion) = vbYes)
End Function

Private Sub Info(ByVal txt As String, Optional ByVal ok As Boolean = True)
    shForm.Range(F_MSG).Value = txt
    With shForm.Range(F_MSG).MergeArea
        If ok Then
            .Font.Color = RGB(46, 125, 50)
            .Interior.Color = RGB(232, 245, 233)
        Else
            .Font.Color = RGB(198, 40, 40)
            .Interior.Color = RGB(253, 236, 234)
        End If
    End With
End Sub

Private Sub BeginOp()
    mBusy = True
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    On Error Resume Next
    shForm.Unprotect
    On Error GoTo 0
End Sub

Private Sub EndOp()
    On Error Resume Next
    Application.Calculate
    shForm.Protect DrawingObjects:=False, Contents:=True, Scenarios:=True
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    mBusy = False
End Sub

Private Sub Fail(ByVal where As String)
    Dim d As String
    d = Err.Description
    Info M(MSG_ERR) & where & " - " & d, False
    EndOp
End Sub

Private Function Num(ByVal v As Variant) As Double
    If IsEmpty(v) Then
        Num = 0
    ElseIf VarType(v) = vbString Then
        If Trim$(v) = "" Then Num = 0 Else Num = CDbl(v)
    Else
        Num = CDbl(v)
    End If
End Function

Private Function IsBlankOrNumber(ByVal v As Variant) As Boolean
    If IsEmpty(v) Then
        IsBlankOrNumber = True
    ElseIf VarType(v) = vbString Then
        IsBlankOrNumber = (Trim$(v) = "") Or IsNumeric(v)
    Else
        IsBlankOrNumber = IsNumeric(v)
    End If
End Function

Private Function SameNo(ByVal v As Variant, ByVal no As Variant) As Boolean
    SameNo = False
    If IsEmpty(v) Or IsEmpty(no) Then Exit Function
    If Not IsNumeric(v) Or Not IsNumeric(no) Then Exit Function
    SameNo = (CDbl(v) = CDbl(no))
End Function

Private Sub Go(ByVal addr As String)
    On Error Resume Next
    If ActiveSheet Is shForm Then shForm.Range(addr).Select
End Sub

Private Function LastRow(ByVal ws As Worksheet) As Long
    LastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    If LastRow < DATA0 Then LastRow = DATA0 - 1
End Function

Private Function RegRow(ByVal no As Variant) As Long
    Dim r As Long
    RegRow = 0
    If Not IsNumeric(no) Or IsEmpty(no) Then Exit Function
    For r = DATA0 To LastRow(shReg)
        If SameNo(shReg.Cells(r, 1).Value, no) Then
            RegRow = r
            Exit Function
        End If
    Next r
End Function

Private Function CurrentUser() As String
    On Error Resume Next
    CurrentUser = Application.UserName
    If CurrentUser = "" Then CurrentUser = Environ$("USERNAME")
End Function

Private Sub ClearCell(ByVal addr As String)
    shForm.Range(addr).MergeArea.ClearContents
End Sub

Private Sub ClearForm()
    Dim a As Variant, r As Long
    For Each a In Array(F_DATE, F_PAYEE, F_BEING, F_METHOD, F_CHEQUE, F_FROM, F_FROMBR, F_NOTE, F_RECV)
        ClearCell CStr(a)
    Next a
    For r = LN0 To LN0 + LNN - 1
        ClearCell LC_DR & r
        ClearCell LC_CR & r
        ClearCell LC_DESC & r
        ClearCell LC_BR & r
    Next r
    shForm.Range(F_LOADED).ClearContents
End Sub

Private Sub SetDefaults()
    shForm.Range(F_DATE).Value = Date
    shForm.Range(F_METHOD).Value = shSet.Range(S_DEF_METHOD).Value
    shForm.Range(F_FROM).Value = shSet.Range(S_DEF_FROM).Value
    shForm.Range(F_FROMBR).Value = shSet.Range(S_DEF_BRANCH).Value
End Sub

'----------------------------------------------------------------- validation
Private Function Validate() As Boolean
    Dim r As Long, dr As Variant, cr As Variant, chq As String, rr As Long, cur As Double
    Validate = False
    Application.Calculate
    If Trim$(CStr(shForm.Range(F_PAYEE).Value)) = "" Then
        Info M(MSG_NEED_PAYEE), False: Go F_PAYEE: Exit Function
    End If
    If Not IsDate(shForm.Range(F_DATE).Value) Then
        Info M(MSG_NEED_DATE), False: Go F_DATE: Exit Function
    End If
    For r = LN0 To LN0 + LNN - 1
        dr = shForm.Range(LC_DR & r).Value
        cr = shForm.Range(LC_CR & r).Value
        If Not IsBlankOrNumber(dr) Or Not IsBlankOrNumber(cr) Then
            Info M(MSG_LINE_NUM) & (r - LN0 + 1), False: Go LC_DR & r: Exit Function
        End If
        If Num(dr) < 0 Or Num(cr) < 0 Then
            Info M(MSG_LINE_NUM) & (r - LN0 + 1), False: Go LC_DR & r: Exit Function
        End If
        If Num(dr) > 0 And Num(cr) > 0 Then
            Info M(MSG_LINE_BOTH) & (r - LN0 + 1), False: Go LC_DR & r: Exit Function
        End If
        If (Num(dr) > 0 Or Num(cr) > 0) And Trim$(CStr(shForm.Range(LC_DESC & r).Value)) = "" Then
            Info M(MSG_LINE_DESC) & (r - LN0 + 1), False: Go LC_DESC & r: Exit Function
        End If
    Next r
    If Num(shForm.Range(F_TDR).Value) <= 0 Then
        Info M(MSG_NEED_AMOUNT), False: Go LC_DR & LN0: Exit Function
    End If
    If Num(shForm.Range(F_AUTO).Value) > 0 And Trim$(CStr(shForm.Range(F_FROM).Value)) = "" Then
        Info M(MSG_NEED_FROM), False: Go F_FROM: Exit Function
    End If
    If Round(Num(shForm.Range(F_TDR).Value) - Num(shForm.Range(F_TCR).Value), 2) <> 0 Then
        Info M(MSG_UNBAL), False: Exit Function
    End If
    chq = Trim$(CStr(shForm.Range(F_CHEQUE).Value))
    If chq <> "" Then
        cur = shForm.Range(F_CUR).Value
        For rr = DATA0 To LastRow(shReg)
            If Trim$(CStr(shReg.Cells(rr, 6).Value)) = chq And Not SameNo(shReg.Cells(rr, 1).Value, cur) Then
                If Not Ask(M(MSG_DUP_CHQ) & shReg.Cells(rr, 2).Value & vbCrLf & M(MSG_CONTINUE)) Then Exit Function
                Exit For
            End If
        Next rr
    End If
    Validate = True
End Function

'----------------------------------------------------------------- core save
Private Function SaveCore() As Boolean
    Dim no As Double, isNew As Boolean, rg As Long, r As Long, k As Long, lr As Long
    Dim fromBr As String, br As String, ref As String, tdr As Double, auto As Double, words As String
    SaveCore = False
    If Not Validate() Then Exit Function
    isNew = (Trim$(CStr(shForm.Range(F_LOADED).Value)) = "")
    If Not isNew Then
        If Not Ask(M(MSG_CONFIRM_EDIT) & shForm.Range(F_REF).Value) Then Exit Function
    End If
    ' capture everything that depends on the register BEFORE writing to it
    ' (writing a new number re-calculates "next number" and the displayed reference)
    no = shForm.Range(F_CUR).Value
    ref = CStr(shForm.Range(F_REF).Value)
    tdr = Num(shForm.Range(F_TDR).Value)
    auto = Num(shForm.Range(F_AUTO).Value)
    words = CStr(shForm.Range(F_WORDS).Value)

    ' --- header row
    rg = RegRow(no)
    If rg = 0 Then rg = LastRow(shReg) + 1
    DeleteLines no
    fromBr = CStr(shForm.Range(F_FROMBR).Value)
    With shReg
        .Cells(rg, 1).Value = no
        .Cells(rg, 2).Value = ref
        .Cells(rg, 3).Value = CDate(shForm.Range(F_DATE).Value)
        .Cells(rg, 3).NumberFormat = "dd/mm/yyyy"
        .Cells(rg, 4).Value = shForm.Range(F_PAYEE).Value
        .Cells(rg, 5).Value = shForm.Range(F_METHOD).Value
        .Cells(rg, 6).NumberFormat = "@"
        .Cells(rg, 6).Value = CStr(shForm.Range(F_CHEQUE).Value)
        .Cells(rg, 7).Value = shForm.Range(F_BEING).Value
        .Cells(rg, 8).Value = shForm.Range(F_FROM).Value
        .Cells(rg, 9).Value = fromBr
        .Cells(rg, 10).Value = shForm.Range(F_NOTE).Value
        .Cells(rg, 11).Value = shForm.Range(F_RECV).Value
        .Cells(rg, 12).Value = tdr
        .Cells(rg, 12).NumberFormat = "#,##0.00"
        .Cells(rg, 13).Value = words
        .Cells(rg, 15).Value = Now
        .Cells(rg, 15).NumberFormat = "dd/mm/yyyy hh:mm"
        .Cells(rg, 16).Value = CurrentUser()
    End With

    ' --- lines
    lr = LastRow(shLns)
    k = 0
    For r = LN0 To LN0 + LNN - 1
        If Num(shForm.Range(LC_DR & r).Value) > 0 Or Num(shForm.Range(LC_CR & r).Value) > 0 Then
            k = k + 1
            br = CStr(shForm.Range(LC_BR & r).Value)
            If br = "" Then br = fromBr
            WriteLine lr + k, no, k, br, CStr(shForm.Range(LC_DESC & r).Value), _
                      Num(shForm.Range(LC_DR & r).Value), Num(shForm.Range(LC_CR & r).Value), M(TXT_MANUAL)
        End If
    Next r
    If auto > 0 Then
        k = k + 1
        WriteLine lr + k, no, k, fromBr, CStr(shForm.Range(F_FROM).Value), 0, auto, M(TXT_AUTO)
    End If
    shReg.Cells(rg, 14).Value = k

    SortData
    shForm.Range(F_LOADED).Value = no
    SaveCore = True
End Function

Private Sub WriteLine(ByVal r As Long, ByVal no As Double, ByVal k As Long, ByVal br As String, _
                      ByVal desc As String, ByVal dr As Double, ByVal cr As Double, ByVal kind As String)
    With shLns
        .Cells(r, 1).Value = no
        .Cells(r, 2).Value = k
        .Cells(r, 3).Value = br
        .Cells(r, 4).Value = desc
        If dr > 0 Then .Cells(r, 5).Value = dr Else .Cells(r, 5).ClearContents
        If cr > 0 Then .Cells(r, 6).Value = cr Else .Cells(r, 6).ClearContents
        .Cells(r, 5).NumberFormat = "#,##0.00"
        .Cells(r, 6).NumberFormat = "#,##0.00"
        .Cells(r, 7).Value = CDate(shForm.Range(F_DATE).Value)
        .Cells(r, 7).NumberFormat = "dd/mm/yyyy"
        .Cells(r, 8).Value = shForm.Range(F_PAYEE).Value
        .Cells(r, 9).Value = kind
    End With
End Sub

Private Sub DeleteLines(ByVal no As Double)
    Dim r As Long
    For r = LastRow(shLns) To DATA0 Step -1
        If SameNo(shLns.Cells(r, 1).Value, no) Then shLns.Range(shLns.Cells(r, 1), shLns.Cells(r, LNS_COLS)).Delete Shift:=xlUp
    Next r
End Sub

Private Sub SortData()
    Dim n As Long
    n = LastRow(shReg)
    If n > DATA0 Then
        shReg.Range(shReg.Cells(DATA0, 1), shReg.Cells(n, REG_COLS)).Sort _
            Key1:=shReg.Cells(DATA0, 1), Order1:=xlAscending, Header:=xlNo
    End If
    n = LastRow(shLns)
    If n > DATA0 Then
        shLns.Range(shLns.Cells(DATA0, 1), shLns.Cells(n, LNS_COLS)).Sort _
            Key1:=shLns.Cells(DATA0, 1), Order1:=xlAscending, _
            Key2:=shLns.Cells(DATA0, 2), Order2:=xlAscending, Header:=xlNo
    End If
End Sub

'----------------------------------------------------------------- core load
Private Function LoadCore(ByVal no As Variant) As Boolean
    Dim rg As Long, r As Long, k As Long
    LoadCore = False
    rg = RegRow(no)
    If rg = 0 Then
        Info M(MSG_NOTFOUND) & " (" & no & ")", False
        Exit Function
    End If
    ClearForm
    With shReg
        shForm.Range(F_DATE).Value = .Cells(rg, 3).Value
        shForm.Range(F_PAYEE).Value = .Cells(rg, 4).Value
        shForm.Range(F_METHOD).Value = .Cells(rg, 5).Value
        shForm.Range(F_CHEQUE).NumberFormat = "@"
        shForm.Range(F_CHEQUE).Value = CStr(.Cells(rg, 6).Value)
        shForm.Range(F_BEING).Value = .Cells(rg, 7).Value
        shForm.Range(F_FROM).Value = .Cells(rg, 8).Value
        shForm.Range(F_FROMBR).Value = .Cells(rg, 9).Value
        shForm.Range(F_NOTE).Value = .Cells(rg, 10).Value
        shForm.Range(F_RECV).Value = .Cells(rg, 11).Value
    End With
    k = 0
    For r = DATA0 To LastRow(shLns)
        If SameNo(shLns.Cells(r, 1).Value, no) And CStr(shLns.Cells(r, 9).Value) <> M(TXT_AUTO) Then
            If k < LNN Then
                If Num(shLns.Cells(r, 5).Value) > 0 Then shForm.Range(LC_DR & (LN0 + k)).Value = shLns.Cells(r, 5).Value
                If Num(shLns.Cells(r, 6).Value) > 0 Then shForm.Range(LC_CR & (LN0 + k)).Value = shLns.Cells(r, 6).Value
                shForm.Range(LC_DESC & (LN0 + k)).Value = shLns.Cells(r, 4).Value
                shForm.Range(LC_BR & (LN0 + k)).Value = shLns.Cells(r, 3).Value
            End If
            k = k + 1
        End If
    Next r
    shForm.Range(F_LOADED).Value = CDbl(no)
    shForm.Range(F_LOADNO).Value = CDbl(no)
    Info M(MSG_LOADED) & shReg.Cells(rg, 2).Value
    LoadCore = True
End Function

Private Function Neighbour(ByVal dirn As Long) As Variant
    ' dirn = -1 previous, +1 next ; returns Empty when none
    Dim r As Long, v As Double, cur As Double, best As Variant
    cur = shForm.Range(F_CUR).Value
    best = Empty
    For r = DATA0 To LastRow(shReg)
        If IsNumeric(shReg.Cells(r, 1).Value) And Not IsEmpty(shReg.Cells(r, 1).Value) Then
            v = shReg.Cells(r, 1).Value
            If dirn < 0 And v < cur Then
                If IsEmpty(best) Then
                    best = v
                ElseIf v > best Then
                    best = v
                End If
            ElseIf dirn > 0 And v > cur Then
                If IsEmpty(best) Then
                    best = v
                ElseIf v < best Then
                    best = v
                End If
            End If
        End If
    Next r
    Neighbour = best
End Function

'================================================================= public buttons
Public Sub SaveAndNew()
    Dim ref As String
    On Error GoTo EH
    BeginOp
    If SaveCore() Then
        ref = shForm.Range(F_REF).Value
        ClearForm
        SetDefaults
        Application.Calculate
        Info M(MSG_SAVED) & ref & "   " & M(MSG_READY_NEW) & shForm.Range(F_REF).Value
    End If
    EndOp
    Go F_PAYEE
    Exit Sub
EH:
    Fail "SaveAndNew"
End Sub

Public Sub SaveVoucher()
    On Error GoTo EH
    BeginOp
    If SaveCore() Then Info M(MSG_SAVED) & shForm.Range(F_REF).Value
    EndOp
    Exit Sub
EH:
    Fail "SaveVoucher"
End Sub

Public Sub SaveAndPrint()
    Dim ok As Boolean, copies As Long
    On Error GoTo EH
    BeginOp
    ok = SaveCore()
    EndOp
    If ok Then
        copies = 1
        If IsNumeric(shForm.Range(F_COPIES).Value) Then copies = Application.Max(1, CLng(Num(shForm.Range(F_COPIES).Value)))
        shForm.PrintOut Copies:=copies
        BeginOp
        Info M(MSG_PRINTED) & shForm.Range(F_REF).Value
        EndOp
    End If
    Exit Sub
EH:
    Fail "SaveAndPrint"
End Sub

Public Sub PreviewVoucher()
    On Error GoTo EH
    shForm.PrintPreview
    Exit Sub
EH:
    Fail "PreviewVoucher"
End Sub

Public Sub SaveAsPDF()
    Dim ok As Boolean, folder As String, fname As String, sep As String
    On Error GoTo EH
    BeginOp
    ok = SaveCore()
    EndOp
    If Not ok Then Exit Sub
    sep = Application.PathSeparator
    folder = ThisWorkbook.Path
    If folder = "" Then folder = CurDir$
    folder = folder & sep & "Vouchers_PDF"
    If Dir(folder, vbDirectory) = "" Then MkDir folder
    fname = folder & sep & shForm.Range(F_REF).Value & ".pdf"
    shForm.ExportAsFixedFormat Type:=xlTypePDF, Filename:=fname, Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, IgnorePrintAreas:=False, OpenAfterPublish:=True
    BeginOp
    Info M(MSG_PDF) & fname
    EndOp
    Exit Sub
EH:
    Fail "SaveAsPDF"
End Sub

Public Sub NewVoucher()
    On Error GoTo EH
    BeginOp
    ClearForm
    SetDefaults
    Application.Calculate
    Info M(MSG_NEW) & shForm.Range(F_REF).Value
    EndOp
    Go F_PAYEE
    Exit Sub
EH:
    Fail "NewVoucher"
End Sub

Public Sub DuplicateVoucher()
    On Error GoTo EH
    BeginOp
    shForm.Range(F_LOADED).ClearContents
    shForm.Range(F_DATE).Value = Date
    ClearCell F_CHEQUE
    Application.Calculate
    Info M(MSG_DUP) & shForm.Range(F_REF).Value
    EndOp
    Exit Sub
EH:
    Fail "DuplicateVoucher"
End Sub

Public Sub LoadVoucher(ByVal no As Variant)
    On Error GoTo EH
    BeginOp
    LoadCore no
    EndOp
    Exit Sub
EH:
    Fail "LoadVoucher"
End Sub

Public Sub LoadFromInput()
    Dim v As Variant
    v = shForm.Range(F_LOADNO).Value
    If IsEmpty(v) Or Not IsNumeric(v) Then
        BeginOp
        Info M(MSG_NOTFOUND), False
        EndOp
        Exit Sub
    End If
    LoadVoucher v
End Sub

Public Sub PrevVoucher()
    Dim v As Variant
    v = Neighbour(-1)
    If IsEmpty(v) Then
        BeginOp: Info M(MSG_NO_PREV), False: EndOp
    Else
        LoadVoucher v
    End If
End Sub

Public Sub NextVoucher()
    Dim v As Variant
    v = Neighbour(1)
    If IsEmpty(v) Then
        BeginOp: Info M(MSG_NO_NEXT), False: EndOp
    Else
        LoadVoucher v
    End If
End Sub

Public Sub DeleteVoucher()
    Dim no As Double, ref As String, rg As Long
    On Error GoTo EH
    If Trim$(CStr(shForm.Range(F_LOADED).Value)) = "" Then
        BeginOp: Info M(MSG_NOT_SAVED), False: EndOp
        Exit Sub
    End If
    no = shForm.Range(F_LOADED).Value
    ref = shForm.Range(F_REF).Value
    If Not Ask(M(MSG_CONFIRM_DEL) & ref) Then Exit Sub
    BeginOp
    rg = RegRow(no)
    If rg > 0 Then shReg.Range(shReg.Cells(rg, 1), shReg.Cells(rg, REG_COLS)).Delete Shift:=xlUp
    DeleteLines no
    ClearForm
    SetDefaults
    Info M(MSG_DELETED) & ref
    EndOp
    Exit Sub
EH:
    Fail "DeleteVoucher"
End Sub

'----------------------------------------------------------------- dispatch (hyperlink buttons)
Public Sub RunButton(ByVal addr As String)
    If mBusy Then Exit Sub
    Select Case addr
'@@DISPATCH@@
    End Select
End Sub

Public Sub FormChanged(ByVal Target As Range)
    If mBusy Then Exit Sub
    If Not Intersect(Target, shForm.Range(F_LOADNO)) Is Nothing Then
        If Not IsEmpty(shForm.Range(F_LOADNO).Value) Then LoadFromInput
    End If
End Sub

Public Sub OpenFromList(ByVal ws As Worksheet, ByVal r As Long)
    If r < DATA0 Then Exit Sub
    If IsEmpty(ws.Cells(r, 1).Value) Or Not IsNumeric(ws.Cells(r, 1).Value) Then Exit Sub
    LoadVoucher ws.Cells(r, 1).Value
    shForm.Activate
    Go F_PAYEE
End Sub
